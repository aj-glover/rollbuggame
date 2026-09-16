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
  };

  private keys: Set<string> = new Set();
  private hasGyro = false;
  private gyroPermissionGranted = false;
  
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
  private readonly FLICK_COOLDOWN_TIME = 0.8; // seconds between flicks
  private readonly FLICK_THRESHOLD = 6; // minimum velocity to count as flick
  
  // Jump buffer - stores jump requests for one frame
  private jumpRequested = false;
  private flickRequested = false;

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
    this.setupMouse();
    this.setupGyroscope();
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys.add(key);
      
      if (e.key === ' ' || key === 'space') {
        e.preventDefault();
        this.jumpRequested = true;
      }
      
      // F key for flick detection (desktop testing)
      if (key === 'f') {
        this.flickRequested = true;
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

  async setupGyroscope() {
    if ('DeviceOrientationEvent' in window) {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === 'function') {
        // iOS 13+ requires explicit permission
        this.hasGyro = true;
      } else if ('ondeviceorientation' in window) {
        // Android and older iOS
        this.hasGyro = true;
        this.gyroPermissionGranted = true;
        this.attachGyroListener();
      }
    }
  }

  private attachGyroListener() {
    window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // gamma: left/right tilt (-90 to 90)
        // beta: front/back tilt (-180 to 180)
        this.state.tiltX = Math.max(-1, Math.min(1, e.gamma / 45));
        // Subtract 45 from beta to account for typical phone holding angle
        this.state.tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
      }
    });
  }

  async requestGyroPermission(): Promise<boolean> {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
          this.gyroPermissionGranted = true;
          this.attachGyroListener();
          return true;
        }
      } catch (e) {
        console.error('Gyro permission denied', e);
      }
      return false;
    }
    // Non-iOS devices don't need permission
    return this.hasGyro;
  }

  update(dt: number) {
    // Clamp dt to prevent division issues
    const safeDt = Math.max(0.001, dt);
    
    // === TILT INPUT ===
    // Use gyro if available, otherwise keyboard
    if (this.gyroPermissionGranted && this.hasGyro) {
      // Gyro input is set by event listener, just apply smoothing
      // No keyboard override when gyro is active
    } else {
      // Keyboard simulation of tilt
      let kx = 0;
      let ky = 0;
      if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) ky += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) ky -= 1;
      
      // Smooth keyboard tilt (responsive but not instant)
      const smoothing = Math.min(1, safeDt * 10);
      this.state.tiltX += (kx - this.state.tiltX) * smoothing;
      this.state.tiltY += (ky - this.state.tiltY) * smoothing;
    }

    // === FLICK DETECTION ===
    // Decrement cooldown
    if (this.flickCooldown > 0) {
      this.flickCooldown -= safeDt;
    }
    
    // Check for requested flicks (from keyboard F, touch swipe, or mouse movement)
    if (this.flickRequested && this.flickCooldown <= 0) {
      this.state.flickDetected = true;
      this.state.flickStrength = 1;
      this.flickCooldown = this.FLICK_COOLDOWN_TIME;
      this.flickRequested = false;
    } else {
      // Also detect flick from gyro velocity (rapid phone movement)
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
        // Decay flick strength smoothly
        this.state.flickStrength *= Math.max(0, 1 - safeDt * 5);
        if (this.state.flickStrength < 0.05) {
          this.state.flickStrength = 0;
        }
      }
    }
    
    // Store for next frame velocity calculation
    this.state.lastTiltX = this.state.tiltX;
    this.state.lastTiltY = this.state.tiltY;

    // === HULA ROLL DETECTION ===
    this.detectHulaRoll();

    // === JUMP ===
    // Transfer buffered jump to state (consumed by game engine, then cleared)
    this.state.jump = this.jumpRequested;
    this.jumpRequested = false;
  }

  private detectHulaRoll() {
    const points = this.state.hulaPoints;
    
    // Need minimum points for detection
    if (points.length < 8) {
      this.state.hulaRoll = false;
      return;
    }

    // Calculate center of motion
    let cx = 0, cy = 0;
    for (const p of points) { 
      cx += p.x; 
      cy += p.y; 
    }
    cx /= points.length;
    cy /= points.length;

    // Calculate average radius
    let radius = 0;
    for (const p of points) {
      radius += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    }
    radius /= points.length;

    // Check circularity (how consistent the radius is)
    let variance = 0;
    for (const p of points) {
      const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      variance += (r - radius) ** 2;
    }
    variance /= points.length;

    const stdDev = Math.sqrt(variance);
    const circularity = radius > 0 ? 1 - Math.min(1, stdDev / radius) : 0;

    this.state.hulaRadius = radius;
    
    // Must have reasonable radius AND be circular
    this.state.hulaRoll = radius > 60 && circularity > 0.55;
  }

  get hasGyroPermission(): boolean {
    return this.gyroPermissionGranted;
  }

  get isMobile(): boolean {
    return this.hasGyro;
  }
}
