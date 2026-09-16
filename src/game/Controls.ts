// Controls - handles gyroscope, keyboard, and touch input

export interface ControlState {
  tiltX: number; // -1 to 1 (left/right lean)
  tiltY: number; // -1 to 1 (forward/back lean)
  jump: boolean;
  hulaRoll: boolean;
  hulaAngle: number;
  hulaRadius: number;
  hulaPoints: { x: number; y: number; t: number }[];
  flickDetected: boolean;
  flickStrength: number;
  lastTiltX: number;
  lastTiltY: number;
  tiltVelocityX: number;
  tiltVelocityY: number;
  gyroAvailable: boolean;
}

export class Controls {
  state: ControlState = {
    tiltX: 0,
    tiltY: 0,
    jump: false,
    hulaRoll: false,
    hulaAngle: 0,
    hulaRadius: 0,
    hulaPoints: [],
    flickDetected: false,
    flickStrength: 0,
    lastTiltX: 0,
    lastTiltY: 0,
    tiltVelocityX: 0,
    tiltVelocityY: 0,
    gyroAvailable: false,
  };

  private keys: Set<string> = new Set();
  private hasGyro = false;
  private gyroPermissionGranted = false;
  private gyroListenerAttached = false;
  private gyroActive = false;
  
  // Touch state
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private lastTouchTime = 0;
  
  // Mouse state
  private mouseDown = false;
  private mouseX = 0;
  private mouseY = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  
  // Flick debounce
  private flickCooldown = 0;
  private readonly FLICK_COOLDOWN_TIME = 0.8;
  private readonly FLICK_THRESHOLD = 6;
  
  // Input buffering
  private jumpRequested = false;
  private flickRequested = false;
  
  // Gyro calibration
  private gyroBaseX = 0;
  private gyroBaseY = 0;
  private isCalibrated = false;

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
    this.setupMouse();
    this.detectGyroscope();
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys.add(key);
      
      if (e.key === ' ' || key === 'space') {
        e.preventDefault();
        this.jumpRequested = true;
      }
      
      if (key === 'f') {
        this.flickRequested = true;
      }
      
      // Calibrate gyro (C key)
      if (key === 'c' && this.gyroActive) {
        this.calibrateGyro();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  private setupTouch() {
    window.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = Date.now();
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.lastTouchTime = Date.now();
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      const dt = Date.now() - this.touchStartTime;
      
      // Quick tap = jump
      if (dt < 250) {
        this.jumpRequested = true;
      }
      
      // Check for touch flick (fast swipe)
      if (e.changedTouches.length > 0) {
        const endTouch = e.changedTouches[0];
        const swipeDt = (Date.now() - this.lastTouchTime) / 1000;
        if (swipeDt > 0 && swipeDt < 0.3) {
          const dx = endTouch.clientX - this.lastTouchX;
          const dy = endTouch.clientY - this.lastTouchY;
          const swipeSpeed = Math.sqrt(dx * dx + dy * dy) / swipeDt;
          if (swipeSpeed > 2000) {
            this.flickRequested = true;
          }
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const now = Date.now();
      
      // Track for hula roll (circular motion)
      this.state.hulaPoints.push({ x: touch.clientX, y: touch.clientY, t: now });
      this.state.hulaPoints = this.state.hulaPoints.filter(p => now - p.t < 1000);
      
      // Track for flick detection (velocity)
      const moveDt = (now - this.lastTouchTime) / 1000;
      if (moveDt > 0.001) {
        const dx = touch.clientX - this.lastTouchX;
        const dy = touch.clientY - this.lastTouchY;
        const speed = Math.sqrt(dx * dx + dy * dy) / moveDt;
        if (speed > 3000) {
          this.flickRequested = true;
        }
      }
      
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.lastTouchTime = now;
    }, { passive: true });
  }

  private setupMouse() {
    window.addEventListener('mousedown', (e) => { 
      this.mouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });
    
    window.addEventListener('mouseup', () => { 
      this.mouseDown = false; 
    });
    
    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      
      // Track for hula roll when mouse is down
      if (this.mouseDown) {
        this.state.hulaPoints.push({ x: e.clientX, y: e.clientY, t: now });
        this.state.hulaPoints = this.state.hulaPoints.filter(p => now - p.t < 1500);
      }
      
      // Track for mouse flick (fast movement)
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 100) {
        this.flickRequested = true;
      }
      
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });
  }

  private detectGyroscope() {
    // Check if device has gyroscope capability
    if ('DeviceOrientationEvent' in window) {
      this.hasGyro = true;
      this.state.gyroAvailable = true;
      
      const DOE = DeviceOrientationEvent as any;
      
      // iOS 13+ requires permission request
      if (typeof DOE.requestPermission === 'function') {
        console.log('iOS device detected - gyro permission required');
        // Don't attach listener yet, wait for permission
      } else {
        // Android and older iOS - gyro works without permission
        console.log('Android/older iOS detected - gyro available');
        this.gyroPermissionGranted = true;
        this.attachGyroListener();
      }
    } else {
      console.log('No gyroscope detected - using keyboard/touch controls');
      this.hasGyro = false;
      this.state.gyroAvailable = false;
    }
  }

  private attachGyroListener() {
    if (this.gyroListenerAttached) return;
    
    console.log('Attaching gyroscope listener');
    
    window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
      // Only process if gyro is active
      if (!this.gyroPermissionGranted) return;
      
      if (e.gamma !== null && e.beta !== null) {
        this.gyroActive = true;
        // gamma: left/right tilt (-90 to 90 degrees)
        // beta: front/back tilt (-180 to 180 degrees)
        
        // Apply calibration offset
        const rawX = e.gamma - this.gyroBaseX;
        const rawY = e.beta - this.gyroBaseY;
        
        // Normalize to -1 to 1 range
        // gamma: -45 to 45 degrees maps to -1 to 1
        // beta: 0 to 90 degrees maps to -1 to 1 (assuming phone held upright)
        this.state.tiltX = Math.max(-1, Math.min(1, rawX / 45));
        this.state.tiltY = Math.max(-1, Math.min(1, (rawY - 45) / 45));
        
        // Auto-calibrate on first reading
        if (!this.isCalibrated) {
          this.gyroBaseX = e.gamma;
          this.gyroBaseY = e.beta;
          this.isCalibrated = true;
          console.log('Gyro auto-calibrated');
        }
      }
    }, { passive: true });
    
    this.gyroListenerAttached = true;
  }

  async requestGyroPermission(): Promise<boolean> {
    if (!this.hasGyro) {
      console.log('No gyroscope available');
      return false;
    }
    
    const DOE = DeviceOrientationEvent as any;
    
    // iOS 13+ requires explicit permission
    if (typeof DOE.requestPermission === 'function') {
      try {
        console.log('Requesting gyroscope permission...');
        const permission = await DOE.requestPermission();
        
        if (permission === 'granted') {
          console.log('Gyroscope permission granted');
          this.gyroPermissionGranted = true;
          this.attachGyroListener();
          return true;
        } else {
          console.log('Gyroscope permission denied');
          return false;
        }
      } catch (error) {
        console.error('Error requesting gyroscope permission:', error);
        return false;
      }
    } else {
      // Non-iOS devices - already set up in detectGyroscope
      return this.gyroPermissionGranted;
    }
  }

  private calibrateGyro() {
    // Reset calibration to current orientation
    this.gyroBaseX = this.state.tiltX * 45 + this.gyroBaseX;
    this.gyroBaseY = this.state.tiltY * 45 + 45 + this.gyroBaseY;
    this.isCalibrated = true;
    console.log('Gyro manually calibrated');
  }

  update(dt: number) {
    const safeDt = Math.max(0.001, dt);
    
    // === TILT INPUT ===
    if (this.gyroActive) {
      // Gyro is active - values are set by event listener
      // Apply smoothing to reduce jitter
      const smoothing = Math.min(1, safeDt * 15);
      // Smooth values are already applied in the event listener
    } else {
      // Fallback to keyboard controls
      let kx = 0;
      let ky = 0;
      if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) ky += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) ky -= 1;
      
      const smoothing = Math.min(1, safeDt * 10);
      this.state.tiltX += (kx - this.state.tiltX) * smoothing;
      this.state.tiltY += (ky - this.state.tiltY) * smoothing;
    }

    // === FLICK DETECTION ===
    if (this.flickCooldown > 0) {
      this.flickCooldown -= safeDt;
    }
    
    if (this.flickRequested && this.flickCooldown <= 0) {
      this.state.flickDetected = true;
      this.state.flickStrength = 1;
      this.flickCooldown = this.FLICK_COOLDOWN_TIME;
      this.flickRequested = false;
    } else {
      // Detect flick from gyro velocity
      const tiltDeltaX = this.state.tiltX - this.state.lastTiltX;
      const tiltDeltaY = this.state.tiltY - this.state.lastTiltY;
      this.state.tiltVelocityX = tiltDeltaX / safeDt;
      this.state.tiltVelocityY = tiltDeltaY / safeDt;
      
      const flickMagnitude = Math.sqrt(
        this.state.tiltVelocityX ** 2 + this.state.tiltVelocityY ** 2
      );
      
      if (flickMagnitude > this.FLICK_THRESHOLD && this.flickCooldown <= 0) {
        this.state.flickDetected = true;
        this.state.flickStrength = Math.min(1, flickMagnitude / 12);
        this.flickCooldown = this.FLICK_COOLDOWN_TIME;
      } else {
        this.state.flickDetected = false;
        this.state.flickStrength *= Math.max(0, 1 - safeDt * 5);
        if (this.state.flickStrength < 0.05) {
          this.state.flickStrength = 0;
        }
      }
    }
    
    this.state.lastTiltX = this.state.tiltX;
    this.state.lastTiltY = this.state.tiltY;

    // === HULA ROLL DETECTION ===
    this.detectHulaRoll();

    // === JUMP ===
    this.state.jump = this.jumpRequested;
    this.jumpRequested = false;
  }

  private detectHulaRoll() {
    const points = this.state.hulaPoints;
    
    if (points.length < 8) {
      this.state.hulaRoll = false;
      return;
    }

    let cx = 0, cy = 0;
    for (const p of points) { 
      cx += p.x; 
      cy += p.y; 
    }
    cx /= points.length;
    cy /= points.length;

    let radius = 0;
    for (const p of points) {
      radius += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    }
    radius /= points.length;

    let variance = 0;
    for (const p of points) {
      const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      variance += (r - radius) ** 2;
    }
    variance /= points.length;

    const stdDev = Math.sqrt(variance);
    const circularity = radius > 0 ? 1 - Math.min(1, stdDev / radius) : 0;

    this.state.hulaRadius = radius;
    this.state.hulaRoll = radius > 60 && circularity > 0.55;
  }

  get hasGyroPermission(): boolean {
    return this.gyroPermissionGranted;
  }

  get isMobile(): boolean {
    return this.hasGyro;
  }
  
  get isGyroActive(): boolean {
    return this.gyroActive;
  }
  
  get isGyroAvailable(): boolean {
    return this.hasGyro;
  }
}
