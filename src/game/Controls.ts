// Controls - handles gyroscope, keyboard, and touch input

export interface ControlState {
  tiltX: number; // -1 to 1 (left/right lean)
  tiltY: number; // -1 to 1 (forward/back lean)
  jump: boolean;
  hulaRoll: boolean;
  hulaAngle: number; // accumulated angle for hula roll detection
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
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private mouseDown = false;
  private mouseX = 0;
  private mouseY = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
    this.setupMouse();
    this.setupGyroscope();
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ') {
        e.preventDefault();
        this.state.jump = true;
      }
      // F key for flick detection (desktop testing)
      if (e.key.toLowerCase() === 'f') {
        this.state.flickDetected = true;
        this.state.flickStrength = 1;
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
    });

    window.addEventListener('touchend', (e) => {
      const dt = Date.now() - this.touchStartTime;
      if (dt < 200) {
        this.state.jump = true;
      }
    });

    window.addEventListener('touchmove', (e) => {
      // Track circular motion for hula roll
      const touch = e.touches[0];
      const now = Date.now();
      this.state.hulaPoints.push({ x: touch.clientX, y: touch.clientY, t: now });
      // Keep only recent points
      this.state.hulaPoints = this.state.hulaPoints.filter(p => now - p.t < 1000);
    });
  }

  private setupMouse() {
    window.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      this.lastMouseX = this.mouseX;
      this.lastMouseY = this.mouseY;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  async setupGyroscope() {
    if ('DeviceOrientationEvent' in window) {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === 'function') {
        // iOS 13+
        this.hasGyro = true;
      } else if ('ondeviceorientation' in window) {
        this.hasGyro = true;
        this.gyroPermissionGranted = true;
        window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
          if (e.gamma !== null && e.beta !== null) {
            this.state.tiltX = Math.max(-1, Math.min(1, e.gamma / 45));
            this.state.tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
          }
        });
      }
    }
  }

  async requestGyroPermission(): Promise<boolean> {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
          this.gyroPermissionGranted = true;
          window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
            if (e.gamma !== null && e.beta !== null) {
              this.state.tiltX = Math.max(-1, Math.min(1, e.gamma / 45));
              this.state.tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
            }
          });
          return true;
        }
      } catch (e) {
        console.error('Gyro permission denied', e);
      }
      return false;
    }
    return false;
  }

  update(dt: number) {
    // Keyboard simulation of tilt
    if (!this.gyroPermissionGranted || !this.hasGyro) {
      let kx = 0;
      let ky = 0;
      if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) ky += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) ky -= 1;
      // Smooth keyboard tilt
      this.state.tiltX += (kx - this.state.tiltX) * Math.min(1, dt * 8);
      this.state.tiltY += (ky - this.state.tiltY) * Math.min(1, dt * 8);
    }

    // Detect flick motion (rapid tilt change)
    const tiltDeltaX = this.state.tiltX - this.state.lastTiltX;
    const tiltDeltaY = this.state.tiltY - this.state.lastTiltY;
    this.state.tiltVelocityX = tiltDeltaX / dt;
    this.state.tiltVelocityY = tiltDeltaY / dt;
    
    const flickMagnitude = Math.sqrt(this.state.tiltVelocityX ** 2 + this.state.tiltVelocityY ** 2);
    
    // Flick threshold - rapid movement
    if (flickMagnitude > 8) {
      this.state.flickDetected = true;
      this.state.flickStrength = Math.min(1, flickMagnitude / 15);
    } else {
      this.state.flickDetected = false;
      this.state.flickStrength *= 0.9;
    }
    
    this.state.lastTiltX = this.state.tiltX;
    this.state.lastTiltY = this.state.tiltY;

    // Mouse-based hula roll detection
    if (this.mouseDown) {
      const now = Date.now();
      this.state.hulaPoints.push({ x: this.mouseX, y: this.mouseY, t: now });
      this.state.hulaPoints = this.state.hulaPoints.filter(p => now - p.t < 1500);
    }

    // Detect hula roll from circular motion
    this.detectHulaRoll();

    // Reset single-frame inputs
    this.state.jump = false;
  }

  private detectHulaRoll() {
    const points = this.state.hulaPoints;
    if (points.length < 10) {
      this.state.hulaRoll = false;
      return;
    }

    // Calculate center of motion
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length;
    cy /= points.length;

    // Calculate average radius
    let radius = 0;
    for (const p of points) {
      radius += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    }
    radius /= points.length;

    // Check if points form a circle (consistent radius)
    let variance = 0;
    for (const p of points) {
      const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      variance += (r - radius) ** 2;
    }
    variance /= points.length;

    const stdDev = Math.sqrt(variance);
    const circularity = 1 - Math.min(1, stdDev / (radius + 1));

    this.state.hulaRadius = radius;
    this.state.hulaRoll = radius > 50 && circularity > 0.5;
  }

  get hasGyroPermission(): boolean {
    return this.gyroPermissionGranted;
  }

  get isMobile(): boolean {
    return this.hasGyro;
  }
}
