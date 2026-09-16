import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Controls } from './Controls';

export interface GameState {
  time: number;
  bestTime: number | null;
  speed: number;
  currentCheckpoint: number;
  totalCheckpoints: number;
  isRunning: boolean;
  isFinished: boolean;
  rollCount: number;
  perfectLandings: number;
  hulaBoostActive: boolean;
  perfectRoll: boolean;
  countdown: number;
  gyroActive: boolean;
  enemyHit: boolean;
}

// Enemy types
type EnemyType = 'ant' | 'spider' | 'beetle' | 'ladybug';

class Enemy {
  mesh: THREE.Group;
  type: EnemyType;
  trackT: number; // position along track (0-1)
  lateralOffset: number; // offset from center
  speed: number; // movement speed along track
  direction: number; // 1 or -1
  size: number;
  isHit: boolean = false;
  hitCooldown: number = 0;
  
  constructor(type: EnemyType, trackT: number, lateralOffset: number = 0) {
    this.type = type;
    this.trackT = trackT;
    this.lateralOffset = lateralOffset;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    
    // Size based on type
    switch(type) {
      case 'ant': this.size = 0.8; this.speed = 0.03; break;
      case 'spider': this.size = 1.2; this.speed = 0.02; break;
      case 'beetle': this.size = 1.5; this.speed = 0.015; break;
      case 'ladybug': this.size = 1.0; this.speed = 0.025; break;
      default: this.size = 1; this.speed = 0.02;
    }
    
    this.mesh = this.createMesh();
  }
  
  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    
    switch(this.type) {
      case 'ant':
        // Black ant with segmented body
        const antBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), antBodyMat);
        head.position.z = -0.4;
        group.add(head);
        // Thorax
        const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), antBodyMat);
        thorax.position.z = 0;
        group.add(thorax);
        // Abdomen
        const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), antBodyMat);
        abdomen.position.z = 0.5;
        group.add(abdomen);
        // Legs
        for (let i = 0; i < 3; i++) {
          for (let side = -1; side <= 1; side += 2) {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.03, 0.02, 0.5, 4),
              antBodyMat
            );
            leg.position.set(side * 0.3, -0.2, (i - 1) * 0.3);
            leg.rotation.z = side * 0.5;
            group.add(leg);
          }
        }
        // Antennae
        for (let side = -1; side <= 1; side += 2) {
          const ant = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.01, 0.3, 4),
            antBodyMat
          );
          ant.position.set(side * 0.1, 0.2, -0.5);
          ant.rotation.x = -0.5;
          ant.rotation.z = side * 0.3;
          group.add(ant);
        }
        break;
        
      case 'spider':
        // Brown spider with hairy legs
        const spiderMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
        // Body
        const spiderBody = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), spiderMat);
        spiderBody.scale.set(1, 0.7, 1.2);
        group.add(spiderBody);
        // Head
        const spiderHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), spiderMat);
        spiderHead.position.z = -0.4;
        group.add(spiderHead);
        // 8 legs
        for (let i = 0; i < 4; i++) {
          for (let side = -1; side <= 1; side += 2) {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.03, 0.02, 0.7, 4),
              spiderMat
            );
            leg.position.set(side * 0.35, -0.1, (i - 1.5) * 0.2);
            leg.rotation.z = side * 0.7;
            leg.rotation.x = (i - 1.5) * 0.2;
            group.add(leg);
          }
        }
        // Eyes (red)
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x660000 });
        for (let side = -1; side <= 1; side += 2) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeMat);
          eye.position.set(side * 0.1, 0.1, -0.5);
          group.add(eye);
        }
        break;
        
      case 'beetle':
        // Green beetle with shiny shell
        const beetleShellMat = new THREE.MeshStandardMaterial({ 
          color: 0x2d5a27, roughness: 0.3, metalness: 0.6 
        });
        const beetleBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
        // Shell
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), beetleShellMat);
        shell.scale.set(1, 0.6, 1.3);
        shell.position.y = 0.1;
        group.add(shell);
        // Body underneath
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), beetleBodyMat);
        body.scale.set(1, 0.5, 1.2);
        group.add(body);
        // Head
        const beetleHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), beetleBodyMat);
        beetleHead.position.z = -0.6;
        group.add(beetleHead);
        // Legs
        for (let i = 0; i < 3; i++) {
          for (let side = -1; side <= 1; side += 2) {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.04, 0.03, 0.5, 4),
              beetleBodyMat
            );
            leg.position.set(side * 0.4, -0.3, (i - 1) * 0.3);
            leg.rotation.z = side * 0.6;
            group.add(leg);
          }
        }
        break;
        
      case 'ladybug':
        // Red ladybug with black spots
        const ladybugShellMat = new THREE.MeshStandardMaterial({ 
          color: 0xcc0000, roughness: 0.4, metalness: 0.3 
        });
        const ladybugSpotMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.7 });
        // Shell
        const ladybugShell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), ladybugShellMat);
        ladybugShell.scale.set(1, 0.6, 1.1);
        ladybugShell.position.y = 0.1;
        group.add(ladybugShell);
        // Spots
        for (let i = 0; i < 6; i++) {
          const spot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), ladybugSpotMat);
          const angle = (i / 6) * Math.PI * 2;
          spot.position.set(
            Math.cos(angle) * 0.3,
            0.25,
            Math.sin(angle) * 0.35
          );
          group.add(spot);
        }
        // Head
        const ladybugHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), ladybugSpotMat);
        ladybugHead.position.z = -0.45;
        group.add(ladybugHead);
        // Legs
        for (let i = 0; i < 3; i++) {
          for (let side = -1; side <= 1; side += 2) {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.03, 0.02, 0.4, 4),
              ladybugSpotMat
            );
            leg.position.set(side * 0.35, -0.2, (i - 1) * 0.25);
            leg.rotation.z = side * 0.5;
            group.add(leg);
          }
        }
        break;
    }
    
    group.scale.setScalar(this.size);
    return group;
  }
  
  update(dt: number, trackCurve: THREE.CatmullRomCurve3) {
    // Move along track
    this.trackT += this.speed * this.direction * dt;
    
    // Bounce at track ends
    if (this.trackT > 0.95 || this.trackT < 0.05) {
      this.direction *= -1;
      this.trackT = Math.max(0.05, Math.min(0.95, this.trackT));
    }
    
    // Update position
    const point = trackCurve.getPoint(this.trackT);
    const tangent = trackCurve.getTangent(this.trackT).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    
    this.mesh.position.copy(point)
      .add(right.clone().multiplyScalar(this.lateralOffset))
      .add(new THREE.Vector3(0, 0.5, 0));
    
    // Orient along track
    const lookTarget = this.mesh.position.clone().add(tangent.multiplyScalar(this.direction));
    this.mesh.lookAt(lookTarget);
    
    // Animate legs (simple bobbing)
    const time = Date.now() * 0.01;
    this.mesh.position.y += Math.sin(time * this.speed * 100) * 0.05;
    
    // Hit cooldown
    if (this.hitCooldown > 0) {
      this.hitCooldown -= dt;
      // Flash when hit
      this.mesh.visible = Math.floor(this.hitCooldown * 10) % 2 === 0;
    } else {
      this.mesh.visible = true;
      this.isHit = false;
    }
  }
  
  checkCollision(bugPosition: THREE.Vector3, bugHeight: number): boolean {
    if (this.hitCooldown > 0) return false;
    
    const distance = this.mesh.position.distanceTo(bugPosition);
    const collisionRadius = this.size * 0.8;
    
    // Only collide if bug is on the ground (not jumping over)
    if (distance < collisionRadius && bugHeight < 1.5) {
      this.isHit = true;
      this.hitCooldown = 1.5; // Invulnerable for 1.5 seconds
      return true;
    }
    
    return false;
  }
}

// Track curve points for "Backyard Run" - with more loops!
function createTrackCurve(): THREE.CatmullRomCurve3 {
  const s = 6; // scale factor
  const points = [
    // Start - wide section for walking
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, -6 * s),
    new THREE.Vector3(0, 1, -10 * s),
    
    // Loop 1 - Small vertical loop
    new THREE.Vector3(2 * s, 2, -12 * s),
    new THREE.Vector3(4 * s, 5, -12 * s),
    new THREE.Vector3(5 * s, 9, -11 * s),
    new THREE.Vector3(4 * s, 12, -9 * s),
    new THREE.Vector3(2 * s, 9, -8 * s),
    new THREE.Vector3(1 * s, 5, -9 * s),
    
    // Transition to loop 2
    new THREE.Vector3(0, 3, -7 * s),
    new THREE.Vector3(-2 * s, 2, -5 * s),
    
    // Loop 2 - Medium loop (tilted)
    new THREE.Vector3(-4 * s, 3, -3 * s),
    new THREE.Vector3(-6 * s, 7, -2 * s),
    new THREE.Vector3(-6 * s, 12, 0),
    new THREE.Vector3(-4 * s, 15, 2 * s),
    new THREE.Vector3(-2 * s, 12, 3 * s),
    new THREE.Vector3(-1 * s, 7, 2 * s),
    
    // Wide section (hula roll opportunity)
    new THREE.Vector3(0, 4, 4 * s),
    new THREE.Vector3(3 * s, 3, 6 * s),
    new THREE.Vector3(6 * s, 3, 7 * s),
    
    // Loop 3 - Large loop
    new THREE.Vector3(9 * s, 5, 6 * s),
    new THREE.Vector3(11 * s, 10, 4 * s),
    new THREE.Vector3(11 * s, 16, 2 * s),
    new THREE.Vector3(9 * s, 20, 0),
    new THREE.Vector3(7 * s, 16, -1 * s),
    new THREE.Vector3(6 * s, 10, 0),
    
    // Transition to loop 4
    new THREE.Vector3(4 * s, 6, 2 * s),
    new THREE.Vector3(2 * s, 4, 4 * s),
    
    // Loop 4 - Corkscrew loop
    new THREE.Vector3(0, 5, 6 * s),
    new THREE.Vector3(-2 * s, 9, 7 * s),
    new THREE.Vector3(-3 * s, 14, 6 * s),
    new THREE.Vector3(-2 * s, 18, 4 * s),
    new THREE.Vector3(0, 14, 3 * s),
    new THREE.Vector3(1 * s, 9, 4 * s),
    
    // Narrow bridge section
    new THREE.Vector3(2 * s, 6, 6 * s),
    new THREE.Vector3(4 * s, 5, 8 * s),
    
    // Final downhill
    new THREE.Vector3(7 * s, 3, 10 * s),
    new THREE.Vector3(11 * s, 2, 11 * s),
    new THREE.Vector3(15 * s, 1, 10 * s),
    new THREE.Vector3(18 * s, 1, 9 * s),
  ];
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
}

export class GameEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: CANNON.World;
  private controls!: Controls;
  private clock: THREE.Clock;
  private container: HTMLElement;
  private animationId: number = 0;

  // Track
  private trackCurve!: THREE.CatmullRomCurve3;
  private trackMesh!: THREE.Group;
  private trackBodies: CANNON.Body[] = [];

  // Player
  private bugMesh!: THREE.Group;
  private bugBody!: CANNON.Body;
  private bugSegments: THREE.Mesh[] = [];
  private bugLegs: THREE.Mesh[] = [];
  private legTime = 0;
  private bugSquash = 1;
  private bugTargetSquash = 1;
  private bugWobble = 0;
  private wobblePhase = 0;

  // Game state
  state: GameState = {
    time: 0,
    bestTime: null,
    speed: 0,
    currentCheckpoint: 0,
    totalCheckpoints: 8,
    isRunning: false,
    isFinished: false,
    rollCount: 0,
    perfectLandings: 0,
    hulaBoostActive: false,
    perfectRoll: false,
    countdown: 0,
    gyroActive: false,
    enemyHit: false,
  };

  // Movement state
  private trackT = 0; // position along track (0-1)
  private lateralOffset = 0; // offset from track center
  private lateralVelocity = 0;
  private verticalVelocity = 0;
  private heightAboveTrack = 0;
  private forwardSpeed = 0;
  private baseSpeed = 12; // Slower walking speed
  private rollSpeed = 25; // Faster rolling speed
  private isGrounded = true;
  private wasGrounded = true;
  private isRolling = false;
  private rollTimer = 0;
  private checkpoints: { t: number; index: number }[] = [];
  private lastHulaState = false;
  private landingImpact = 0;
  private countdown = 0;
  private gameStarted = false;

  // Camera
  private cameraPos = new THREE.Vector3();
  private cameraLookAt = new THREE.Vector3();
  
  // Rattling/shaking (spray can effect)
  private rattleTime = 0;
  private rattleIntensity = 0.02;
  
  // Bug state
  private isWalking = true; // Start in walking mode
  private rollTransition = 0; // 0 = walking, 1 = fully rolled

  // Particles
  private speedParticles!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleVelocities: number[] = [];
  private particleLifetimes: number[] = [];
  private maxParticles = 100;

  // Checkpoint markers
  private checkpointMarkers: THREE.Mesh[] = [];
  private finishMarker!: THREE.Group;

  // Enemies
  private enemies: Enemy[] = [];
  
  // Callbacks
  onStateChange?: (state: GameState) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.init();
  }

  private init() {
    try {
      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // Ensure container has dimensions
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.renderer.setSize(width, height);
      
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.3;
      this.container.appendChild(this.renderer.domElement);
    } catch (error) {
      console.error('Failed to initialize WebGL renderer:', error);
      return;
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7EC8E3);
    this.scene.fog = new THREE.FogExp2(0x7EC8E3, 0.004);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      800
    );

    // Physics world
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -25, 0) });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.allowSleep = false;

    // Controls
    this.controls = new Controls();

    // Build everything
    this.setupLighting();
    this.buildTrack();
    this.buildPillBug();
    this.buildEnvironment();
    this.setupCheckpoints();

    // Set initial position
    this.resetToStart();

    // Initialize camera position
    const startPoint = this.trackCurve.getPoint(0);
    const startTangent = this.trackCurve.getTangent(0).normalize();
    this.cameraPos.set(
      startPoint.x - startTangent.x * 10,
      startPoint.y + 5,
      startPoint.z - startTangent.z * 10
    );
    this.cameraLookAt.set(
      startPoint.x + startTangent.x * 5,
      startPoint.y + 1,
      startPoint.z + startTangent.z * 5
    );
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);

    // Resize handler
    window.addEventListener('resize', () => this.onResize());

    // Start render loop
    this.clock.start();
    this.animate();
  }

  private setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x6088a0, 0.5);
    this.scene.add(ambient);

    // Sun
    const sun = new THREE.DirectionalLight(0xFFE8C0, 1.8);
    sun.position.set(60, 100, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d6b35, 0.5);
    this.scene.add(hemi);

    // Fill light
    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-30, 20, -50);
    this.scene.add(fill);
  }

  private buildTrack() {
    this.trackCurve = createTrackCurve();
    this.trackMesh = new THREE.Group();

    // Build track surface as a tube-like ribbon
    const segments = 600;
    const trackWidth = 6; // Wider base track
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = this.trackCurve.getPoint(t);
      const tangent = this.trackCurve.getTangent(t).normalize();
      
      // Calculate right vector
      let up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      up = new THREE.Vector3().crossVectors(right, tangent).normalize();

      // Banking on curves
      const nextT = Math.min(1, t + 0.005);
      const nextTangent = this.trackCurve.getTangent(nextT).normalize();
      const curveDir = new THREE.Vector3().subVectors(nextTangent, tangent);
      const bankAngle = new THREE.Vector3().crossVectors(tangent, curveDir).y * 20;
      
      const bankedRight = right.clone().applyAxisAngle(tangent, bankAngle * 0.3);

      // Width variation - dramatic changes
      let w = trackWidth;
      if (t < 0.15) w = 8; // Very wide start (walking section)
      else if (t > 0.25 && t < 0.35) w = 2.5; // Narrow branch section
      else if (t > 0.55 && t < 0.70) w = 9; // Very wide (hula roll zone)
      else if (t > 0.80 && t < 0.85) w = 3; // Narrow finish approach

      // Section color
      let color = new THREE.Color(0x8B6914); // Default: root/branch brown
      if (t < 0.1) color = new THREE.Color(0x6B8E23); // Start: mossy green
      else if (t > 0.15 && t < 0.30) color = new THREE.Color(0x8B7355); // Curve: warm wood
      else if (t > 0.33 && t < 0.40) color = new THREE.Color(0x556B2F); // Narrow: dark green (branch)
      else if (t > 0.45 && t < 0.55) color = new THREE.Color(0xA0522D); // Banked: sienna
      else if (t > 0.58 && t < 0.68) color = new THREE.Color(0x9ACD32); // Wide: yellow-green (leaf)
      else if (t > 0.75 && t < 0.85) color = new THREE.Color(0xCD853F); // Loop: peru
      else if (t > 0.90) color = new THREE.Color(0xDAA520); // Final: goldenrod

      // Left and right vertices
      const leftPt = point.clone().add(bankedRight.clone().multiplyScalar(-w));
      const rightPt = point.clone().add(bankedRight.clone().multiplyScalar(w));

      positions.push(leftPt.x, leftPt.y, leftPt.z);
      positions.push(rightPt.x, rightPt.y, rightPt.z);
      normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
      uvs.push(0, t * 30, 1, t * 30);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.trackMesh.add(mesh);

    // Track edges (rails)
    this.buildTrackRails(segments, trackWidth);

    // Track supports (roots/branches underneath)
    this.buildTrackSupports();

    this.scene.add(this.trackMesh);

    // Start line marker
    const startPt = this.trackCurve.getPoint(0.01);
    const startTan = this.trackCurve.getTangent(0.01).normalize();
    const startRight = new THREE.Vector3().crossVectors(startTan, new THREE.Vector3(0, 1, 0)).normalize();
    
    const startLineGeom = new THREE.BoxGeometry(8, 0.1, 0.5);
    const startLineMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 
    });
    const startLine = new THREE.Mesh(startLineGeom, startLineMat);
    startLine.position.set(startPt.x, startPt.y + 0.1, startPt.z);
    startLine.lookAt(startPt.clone().add(startTan));
    this.trackMesh.add(startLine);

    // Start arch
    const startArchGeom = new THREE.TorusGeometry(3.5, 0.2, 8, 16, Math.PI);
    const startArchMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x44aaff,
      emissiveIntensity: 0.5,
    });
    const startArch = new THREE.Mesh(startArchGeom, startArchMat);
    startArch.position.set(startPt.x, startPt.y + 0.3, startPt.z);
    startArch.lookAt(startPt.clone().add(startTan));
    startArch.rotateX(Math.PI / 2);
    this.trackMesh.add(startArch);

    // Build physics ground along track
    this.buildTrackPhysics();
  }

  private buildTrackRails(segments: number, trackWidth: number) {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x5C3A1E,
      roughness: 0.7,
      metalness: 0.1,
    });

    for (let side = -1; side <= 1; side += 2) {
      const railPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const point = this.trackCurve.getPoint(t);
        const tangent = this.trackCurve.getTangent(t).normalize();
        const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        
        let w = trackWidth;
        if (t > 0.33 && t < 0.40) w = 2;
        if (t > 0.58 && t < 0.68) w = 6;
        
        const railPt = point.clone().add(right.clone().multiplyScalar(side * w));
        railPt.y += 0.3;
        railPoints.push(railPt);
      }
      
      const railCurve = new THREE.CatmullRomCurve3(railPoints);
      const railGeom = new THREE.TubeGeometry(railCurve, 100, 0.25, 6, false);
      const rail = new THREE.Mesh(railGeom, railMat);
      rail.castShadow = true;
      this.trackMesh.add(rail);
    }
  }

  private buildTrackSupports() {
    const supportMat = new THREE.MeshStandardMaterial({
      color: 0x4A3520,
      roughness: 0.9,
    });

    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const point = this.trackCurve.getPoint(t);
      
      if (point.y > 3) {
        const height = point.y + 1;
        const supportGeom = new THREE.CylinderGeometry(0.3, 0.5, height, 6);
        const support = new THREE.Mesh(supportGeom, supportMat);
        support.position.set(point.x, point.y - height / 2, point.z);
        support.castShadow = true;
        this.trackMesh.add(support);
      }
    }
  }

  private buildTrackPhysics() {
    // Create a series of box bodies along the track for collision
    const numBodies = 150;
    const groundMat = new CANNON.Material('track');
    
    for (let i = 0; i < numBodies; i++) {
      const t = i / numBodies;
      const point = this.trackCurve.getPoint(t);
      const tangent = this.trackCurve.getTangent(t).normalize();
      
      let w = 6;
      if (t < 0.15) w = 8;
      else if (t > 0.25 && t < 0.35) w = 2.5;
      else if (t > 0.55 && t < 0.70) w = 9;
      else if (t > 0.80 && t < 0.85) w = 3;

      const body = new CANNON.Body({
        mass: 0,
        material: groundMat,
        position: new CANNON.Vec3(point.x, point.y - 0.5, point.z),
      });

      const shape = new CANNON.Box(new CANNON.Vec3(w, 0.5, 2));
      body.addShape(shape);

      // Orient along track
      const angle = Math.atan2(tangent.x, tangent.z);
      const quat = new CANNON.Quaternion();
      quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      body.quaternion.copy(quat);

      this.world.addBody(body);
      this.trackBodies.push(body);
    }
  }

  private buildPillBug() {
    this.bugMesh = new THREE.Group();

    // Body segments
    const segCount = 6;
    const segMat = new THREE.MeshStandardMaterial({
      color: 0x2C3E50,
      roughness: 0.25,
      metalness: 0.5,
    });

    for (let i = 0; i < segCount; i++) {
      const size = 0.7 - Math.abs(i - 2.5) * 0.08;
      const geom = new THREE.SphereGeometry(size, 10, 8);
      geom.scale(1, 0.65, 1.1);
      
      const color = new THREE.Color(0x2C3E50);
      color.lerp(new THREE.Color(0x1a252f), i / segCount * 0.5);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.5,
      });

      const seg = new THREE.Mesh(geom, mat);
      seg.position.z = (i - 2.5) * 0.75;
      seg.castShadow = true;
      this.bugSegments.push(seg);
      this.bugMesh.add(seg);
    }

    // Shell (glossy top)
    const shellGeom = new THREE.SphereGeometry(0.75, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x34495E,
      roughness: 0.1,
      metalness: 0.7,
      transparent: true,
      opacity: 0.8,
    });
    const shell = new THREE.Mesh(shellGeom, shellMat);
    shell.position.y = 0.05;
    shell.scale.set(1, 0.5, 3);
    this.bugMesh.add(shell);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const legGeom = new THREE.CylinderGeometry(0.04, 0.025, 0.4, 4);
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(side * 0.5, -0.35, (i - 2.5) * 0.6);
        leg.rotation.z = side * 0.6;
        this.bugLegs.push(leg);
        this.bugMesh.add(leg);
      }
    }

    // Antennae
    for (let side = -1; side <= 1; side += 2) {
      const antGeom = new THREE.CylinderGeometry(0.02, 0.015, 0.6, 4);
      const ant = new THREE.Mesh(antGeom, legMat);
      ant.position.set(side * 0.15, 0.3, -2.2);
      ant.rotation.x = -0.6;
      ant.rotation.z = side * 0.3;
      this.bugMesh.add(ant);

      const tipGeom = new THREE.SphereGeometry(0.035, 5, 4);
      const tip = new THREE.Mesh(tipGeom, legMat);
      tip.position.set(side * 0.3, 0.6, -2.5);
      this.bugMesh.add(tip);
    }

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 });
    for (let side = -1; side <= 1; side += 2) {
      const eyeGeom = new THREE.SphereGeometry(0.07, 6, 4);
      const eye = new THREE.Mesh(eyeGeom, eyeMat);
      eye.position.set(side * 0.2, 0.1, -1.9);
      this.bugMesh.add(eye);
    }

    this.bugMesh.scale.setScalar(0.9);
    this.scene.add(this.bugMesh);

    // Physics body
    this.bugBody = new CANNON.Body({
      mass: 1.5,
      shape: new CANNON.Sphere(0.7),
      linearDamping: 0.2,
      angularDamping: 0.95,
      material: new CANNON.Material('bug'),
    });
    this.world.addBody(this.bugBody);

    // Contact material
    const trackMat = this.world.bodies[0]?.material ?? new CANNON.Material('track');
    const contactMat = new CANNON.ContactMaterial(this.bugBody.material!, trackMat, {
      friction: 0.4,
      restitution: 0.3,
    });
    this.world.addContactMaterial(contactMat);
  }

  private buildEnvironment() {
    // Ground
    const groundGeom = new THREE.PlaneGeometry(600, 600, 20, 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c3f,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Tall grass (background)
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2d7a27,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 150; i++) {
      const h = 8 + Math.random() * 20;
      const w = 0.5 + Math.random() * 1.5;
      const grassGeom = new THREE.PlaneGeometry(w, h);
      const grass = new THREE.Mesh(grassGeom, grassMat.clone());
      (grass.material as THREE.MeshStandardMaterial).color.setHSL(
        0.28 + Math.random() * 0.06, 0.6, 0.25 + Math.random() * 0.15
      );
      grass.position.set(
        (Math.random() - 0.5) * 250,
        h / 2 - 2,
        (Math.random() - 0.5) * 250
      );
      grass.rotation.y = Math.random() * Math.PI;
      grass.rotation.z = (Math.random() - 0.5) * 0.15;
      this.scene.add(grass);
    }

    // Giant flowers
    const flowerColors = [0xFF69B4, 0xFFD700, 0xFF6347, 0xDA70D6, 0x9370DB];
    for (let i = 0; i < 15; i++) {
      const color = flowerColors[i % flowerColors.length];
      const stemH = 10 + Math.random() * 12;
      
      // Stem
      const stemGeom = new THREE.CylinderGeometry(0.2, 0.4, stemH, 6);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
      const stem = new THREE.Mesh(stemGeom, stemMat);
      const sx = (Math.random() - 0.5) * 180;
      const sz = (Math.random() - 0.5) * 180;
      stem.position.set(sx, stemH / 2 - 2, sz);
      stem.castShadow = true;
      this.scene.add(stem);

      // Flower head
      const fMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
      for (let p = 0; p < 6; p++) {
        const petalGeom = new THREE.SphereGeometry(1.5, 8, 6);
        petalGeom.scale(1, 0.25, 1.5);
        const petal = new THREE.Mesh(petalGeom, fMat);
        const angle = (p / 6) * Math.PI * 2;
        petal.position.set(
          sx + Math.cos(angle) * 1.5,
          stemH - 2,
          sz + Math.sin(angle) * 1.5
        );
        petal.rotation.y = angle;
        this.scene.add(petal);
      }
      // Center
      const centerGeom = new THREE.SphereGeometry(0.8, 8, 6);
      const centerMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.5 });
      const center = new THREE.Mesh(centerGeom, centerMat);
      center.position.set(sx, stemH - 2, sz);
      this.scene.add(center);
    }

    // Fence
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.8 });
    for (let i = 0; i < 40; i++) {
      const postGeom = new THREE.BoxGeometry(0.8, 18, 0.8);
      const post = new THREE.Mesh(postGeom, fenceMat);
      post.position.set(-120 + i * 7, 7, -180);
      post.castShadow = true;
      this.scene.add(post);
    }
    for (let h = 0; h < 2; h++) {
      const railGeom = new THREE.BoxGeometry(280, 0.8, 0.4);
      const rail = new THREE.Mesh(railGeom, fenceMat);
      rail.position.set(15, 5 + h * 7, -180);
      this.scene.add(rail);
    }

    // Garden hose
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.3, metalness: 0.2 });
    const hosePoints = [
      new THREE.Vector3(-50, -1, 30),
      new THREE.Vector3(-30, -1, 50),
      new THREE.Vector3(-10, 0, 40),
      new THREE.Vector3(10, -1, 60),
      new THREE.Vector3(40, -1, 45),
      new THREE.Vector3(60, -1, 55),
    ];
    const hoseCurve = new THREE.CatmullRomCurve3(hosePoints);
    const hoseGeom = new THREE.TubeGeometry(hoseCurve, 40, 1.2, 8, false);
    const hose = new THREE.Mesh(hoseGeom, hoseMat);
    hose.castShadow = true;
    this.scene.add(hose);

    // Pebbles and rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x696969, roughness: 0.9 });
    for (let i = 0; i < 40; i++) {
      const size = 0.8 + Math.random() * 3;
      const rockGeom = new THREE.DodecahedronGeometry(size, 0);
      const rock = new THREE.Mesh(rockGeom, rockMat.clone());
      (rock.material as THREE.MeshStandardMaterial).color.setHSL(0, 0, 0.3 + Math.random() * 0.3);
      rock.position.set(
        (Math.random() - 0.5) * 200,
        -2 + size * 0.4,
        (Math.random() - 0.5) * 200
      );
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      this.scene.add(rock);
    }

    // Fallen leaves
    for (let i = 0; i < 30; i++) {
      const leafGeom = new THREE.PlaneGeometry(1.5 + Math.random() * 2, 2 + Math.random() * 3);
      const leafMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.1, 0.7, 0.35 + Math.random() * 0.2),
        roughness: 0.8,
        side: THREE.DoubleSide,
      });
      const leaf = new THREE.Mesh(leafGeom, leafMat);
      leaf.position.set(
        (Math.random() - 0.5) * 150,
        -1.5 + Math.random(),
        (Math.random() - 0.5) * 150
      );
      leaf.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, 0);
      this.scene.add(leaf);
    }

    // Mushrooms near track
    const capMat = new THREE.MeshStandardMaterial({ color: 0xFF6B6B, roughness: 0.4 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xFFF8DC, roughness: 0.6 });
    for (let i = 0; i < 10; i++) {
      const t = 0.1 + Math.random() * 0.8;
      const pt = this.trackCurve.getPoint(t);
      const tangent = this.trackCurve.getTangent(t);
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const offset = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 6);
      const mx = pt.x + right.x * offset;
      const mz = pt.z + right.z * offset;

      const mStemGeom = new THREE.CylinderGeometry(0.25, 0.35, 1.5, 6);
      const mStem = new THREE.Mesh(mStemGeom, stemMat);
      mStem.position.set(mx, pt.y - 0.5, mz);
      this.scene.add(mStem);

      const mCapGeom = new THREE.SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const mCap = new THREE.Mesh(mCapGeom, capMat.clone());
      (mCap.material as THREE.MeshStandardMaterial).color.setHSL(
        Math.random() * 0.1, 0.7, 0.5
      );
      mCap.position.set(mx, pt.y + 0.2, mz);
      this.scene.add(mCap);
    }
  }

  private setupCheckpoints() {
    const ts = [0.05, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.92];
    this.checkpoints = ts.map((t, i) => ({ t, index: i }));

    // Create checkpoint visual markers
    const cpMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
    });

    for (const cp of this.checkpoints) {
      const point = this.trackCurve.getPoint(cp.t);
      const tangent = this.trackCurve.getTangent(cp.t).normalize();
      
      // Arch marker
      const archGeom = new THREE.TorusGeometry(3, 0.15, 8, 16, Math.PI);
      const arch = new THREE.Mesh(archGeom, cpMat.clone());
      arch.position.set(point.x, point.y + 0.5, point.z);
      
      // Orient arch perpendicular to track
      const lookTarget = point.clone().add(tangent);
      arch.lookAt(lookTarget);
      arch.rotateX(Math.PI / 2);
      
      this.checkpointMarkers.push(arch);
      this.scene.add(arch);
    }

    // Finish line
    this.finishMarker = new THREE.Group();
    const endPoint = this.trackCurve.getPoint(0.97);
    const endTangent = this.trackCurve.getTangent(0.97).normalize();
    
    // Finish arch
    const finishGeom = new THREE.TorusGeometry(4, 0.2, 8, 16, Math.PI);
    const finishMat = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      emissive: 0xFFD700,
      emissiveIntensity: 0.8,
    });
    const finishArch = new THREE.Mesh(finishGeom, finishMat);
    finishArch.position.set(endPoint.x, endPoint.y + 0.5, endPoint.z);
    const finishLook = endPoint.clone().add(endTangent);
    finishArch.lookAt(finishLook);
    finishArch.rotateX(Math.PI / 2);
    this.finishMarker.add(finishArch);

    // Checkered banner
    const bannerGeom = new THREE.PlaneGeometry(8, 1.5);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(endPoint.x, endPoint.y + 4, endPoint.z);
    banner.lookAt(finishLook);
    this.finishMarker.add(banner);

    this.scene.add(this.finishMarker);

    // Initialize speed particles
    this.initParticles();
    
    // Spawn enemies along the track
    this.spawnEnemies();
  }
  
  private spawnEnemies() {
    // Enemy positions along track (trackT values)
    const enemySpawns: { type: EnemyType; t: number; offset: number }[] = [
      // After first loop
      { type: 'ant', t: 0.12, offset: 0 },
      { type: 'ant', t: 0.14, offset: 1.5 },
      
      // Before second loop
      { type: 'spider', t: 0.22, offset: -1 },
      
      // In wide section
      { type: 'ladybug', t: 0.38, offset: 2 },
      { type: 'ladybug', t: 0.40, offset: -2 },
      
      // Before third loop
      { type: 'beetle', t: 0.48, offset: 0 },
      
      // After third loop
      { type: 'ant', t: 0.58, offset: 1 },
      { type: 'spider', t: 0.60, offset: -1.5 },
      
      // Before fourth loop
      { type: 'beetle', t: 0.68, offset: 0.5 },
      { type: 'ant', t: 0.70, offset: -0.5 },
      
      // In narrow section
      { type: 'spider', t: 0.78, offset: 0 },
      
      // Final stretch
      { type: 'ladybug', t: 0.88, offset: 1 },
      { type: 'ant', t: 0.90, offset: -1 },
    ];
    
    for (const spawn of enemySpawns) {
      const enemy = new Enemy(spawn.type, spawn.t, spawn.offset);
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }
  }

  private initParticles() {
    const geometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePositions[i * 3] = 0;
      this.particlePositions[i * 3 + 1] = -100;
      this.particlePositions[i * 3 + 2] = 0;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
      sizes[i] = 0;
      this.particleVelocities.push(0);
      this.particleLifetimes.push(0);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.speedParticles = new THREE.Points(geometry, material);
    this.scene.add(this.speedParticles);
  }

  private updateParticles(dt: number) {
    const positions = this.speedParticles.geometry.attributes.position.array as Float32Array;
    const colors = this.speedParticles.geometry.attributes.color.array as Float32Array;
    
    // Spawn new particles at high speed
    if (this.forwardSpeed > 25 && this.state.isRunning) {
      const bugPos = this.bugMesh.position;
      for (let i = 0; i < this.maxParticles; i++) {
        if (this.particleLifetimes[i] <= 0) {
          const tangent = this.trackCurve.getTangent(this.trackT);
          positions[i * 3] = bugPos.x - tangent.x * 2 + (Math.random() - 0.5) * 2;
          positions[i * 3 + 1] = bugPos.y + (Math.random() - 0.5) * 1;
          positions[i * 3 + 2] = bugPos.z - tangent.z * 2 + (Math.random() - 0.5) * 2;
          this.particleVelocities[i] = 0.5 + Math.random() * 0.5;
          this.particleLifetimes[i] = 0.5 + Math.random() * 0.5;
          
          // Color based on speed
          const speedRatio = this.forwardSpeed / 80;
          colors[i * 3] = 0.5 + speedRatio * 0.5;
          colors[i * 3 + 1] = 0.8 - speedRatio * 0.3;
          colors[i * 3 + 2] = 1 - speedRatio * 0.5;
          break; // Only spawn one per frame
        }
      }
    }

    // Update existing particles
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.particleLifetimes[i] > 0) {
        this.particleLifetimes[i] -= dt;
        positions[i * 3 + 1] += this.particleVelocities[i] * dt * 3;
        positions[i * 3] += (Math.random() - 0.5) * dt * 2;
        
        if (this.particleLifetimes[i] <= 0) {
          positions[i * 3 + 1] = -100; // Hide
        }
      }
    }

    this.speedParticles.geometry.attributes.position.needsUpdate = true;
    this.speedParticles.geometry.attributes.color.needsUpdate = true;
  }

  private updateCheckpointMarkers(dt: number) {
    // Animate checkpoint markers
    const time = this.clock.elapsedTime;
    for (let i = 0; i < this.checkpointMarkers.length; i++) {
      const marker = this.checkpointMarkers[i];
      const mat = marker.material as THREE.MeshStandardMaterial;
      
      // Pulse effect
      const isActive = i < this.state.currentCheckpoint;
      const targetEmissive = isActive ? 0.1 : 0.5;
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * dt * 3;
      
      // Float animation
      const cpPoint = this.trackCurve.getPoint(this.checkpoints[i].t);
      marker.position.y = cpPoint.y + 0.5 + Math.sin(time * 2 + i) * 0.2;
      
      // Color change when passed
      if (isActive) {
        mat.color.setHex(0x44ff44);
        mat.emissive.setHex(0x44ff44);
      } else {
        mat.color.setHex(0x00ff88);
        mat.emissive.setHex(0x00ff88);
      }
    }

    // Animate finish marker
    if (this.finishMarker && this.finishMarker.children[0]) {
      const finishPoint = this.trackCurve.getPoint(0.97);
      this.finishMarker.children[0].position.y = finishPoint.y + 0.5 + Math.sin(time * 3) * 0.15;
    }
  }
  
  private enemyHitTimer = 0;
  
  private updateEnemies(dt: number) {
    const bugPos = this.bugMesh.position.clone();
    
    // Update enemy hit timer
    if (this.enemyHitTimer > 0) {
      this.enemyHitTimer -= dt;
      if (this.enemyHitTimer <= 0) {
        this.state.enemyHit = false;
      }
    }
    
    for (const enemy of this.enemies) {
      enemy.update(dt, this.trackCurve);
      
      // Check collision with bug
      if (enemy.checkCollision(bugPos, this.heightAboveTrack)) {
        // Bug hit enemy - apply knockback/wobble
        this.bugWobble = Math.min(3, this.bugWobble + 1.5);
        this.wobblePhase = 0;
        this.forwardSpeed *= 0.5; // Lose half speed
        this.lateralVelocity += (Math.random() - 0.5) * 10; // Random knockback
        
        // Visual feedback
        this.bugSquash = 0.6;
        
        // Set enemy hit state for UI
        this.state.enemyHit = true;
        this.enemyHitTimer = 1.0; // Show hit indicator for 1 second
      }
    }
  }

  private resetToStart() {
    const startPoint = this.trackCurve.getPoint(0);
    const startTangent = this.trackCurve.getTangent(0);
    
    this.trackT = 0;
    this.lateralOffset = 0;
    this.lateralVelocity = 0;
    this.verticalVelocity = 0;
    this.heightAboveTrack = 0;
    this.forwardSpeed = this.baseSpeed;
    this.isGrounded = true;
    this.isRolling = false;
    this.isWalking = true; // Start in walking mode
    this.rollTransition = 0;
    this.state.currentCheckpoint = 0;
    this.state.time = 0;
    this.state.isFinished = false;
    this.state.rollCount = 0;
    this.state.perfectLandings = 0;

    this.bugBody.position.set(startPoint.x, startPoint.y + 1, startPoint.z);
    this.bugBody.velocity.set(0, 0, 0);
    this.bugBody.angularVelocity.set(0, 0, 0);
  }

  start() {
    this.resetToStart();
    this.state.isRunning = false;
    this.state.isFinished = false;
    this.countdown = 3;
    this.gameStarted = false;
  }

  restart() {
    this.resetToStart();
    this.state.isRunning = false;
    this.state.isFinished = false;
    this.countdown = 3;
    this.gameStarted = false;
  }

  async requestGyroPermission(): Promise<boolean> {
    return this.controls.requestGyroPermission();
  }
  
  get isGyroActive(): boolean {
    return this.controls.isGyroActive;
  }
  
  get isGyroAvailable(): boolean {
    return this.controls.isGyroAvailable;
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    
    try {
      const dt = Math.min(this.clock.getDelta(), 0.05);

      this.controls.update(dt);

      // Countdown
      if (this.countdown > 0) {
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.countdown = 0;
          this.gameStarted = true;
          this.state.isRunning = true;
        }
      }

      if (this.state.isRunning && !this.state.isFinished) {
        this.state.time += dt;
        this.updatePhysics(dt);
      }

      this.updateBugVisuals(dt);
      this.updateCamera(dt);
      this.updateParticles(dt);
      this.updateCheckpointMarkers(dt);
      this.updateEnemies(dt);

      // Step physics (for ground collision only)
      this.world.step(1 / 60, dt, 3);

      this.renderer.render(this.scene, this.camera);

      this.state.speed = this.forwardSpeed;
      this.state.countdown = this.countdown;
      this.state.gyroActive = this.controls.isGyroActive;
      this.onStateChange?.({ ...this.state });
    } catch (error) {
      console.error('Animation loop error:', error);
    }
  }

  private updatePhysics(dt: number) {
    const tiltX = this.controls.state.tiltX;
    const tiltY = this.controls.state.tiltY;

    // Forward speed management
    // Use different base speed for walking vs rolling
    const currentBaseSpeed = this.isRolling ? this.rollSpeed : this.baseSpeed;
    let targetSpeed = currentBaseSpeed;
    targetSpeed += tiltY * 12; // Lean forward/back
    
    // Track slope affects speed
    const currentPoint = this.trackCurve.getPoint(this.trackT);
    const nextPoint = this.trackCurve.getPoint(Math.min(1, this.trackT + 0.01));
    const slope = (nextPoint.y - currentPoint.y) / 0.01;
    targetSpeed -= slope * 0.8; // Downhill = faster

    // Hula boost
    if (this.controls.state.hulaRoll && !this.lastHulaState) {
      this.isRolling = true;
      this.rollTimer = 1.5;
      this.state.rollCount++;
      this.state.hulaBoostActive = true;
      targetSpeed += 25;
    }
    this.lastHulaState = this.controls.state.hulaRoll;

    if (this.rollTimer > 0) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.isRolling = false;
        this.state.hulaBoostActive = false;
      }
    }

    // Smooth speed
    this.forwardSpeed += (targetSpeed - this.forwardSpeed) * dt * 2;
    this.forwardSpeed = Math.max(5, Math.min(80, this.forwardSpeed));

    // Move along track
    const trackLength = this.trackCurve.getLength();
    const tIncrement = (this.forwardSpeed * dt) / trackLength;
    this.trackT = Math.min(1, this.trackT + tIncrement);

    // Get track info at current position
    const point = this.trackCurve.getPoint(this.trackT);
    const tangent = this.trackCurve.getTangent(this.trackT).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Track width at current position
    let trackWidth = 6;
    if (this.trackT < 0.15) trackWidth = 8;
    else if (this.trackT > 0.25 && this.trackT < 0.35) trackWidth = 2.5;
    else if (this.trackT > 0.55 && this.trackT < 0.70) trackWidth = 9;
    else if (this.trackT > 0.80 && this.trackT < 0.85) trackWidth = 3;

    // Lateral physics (weight shifting)
    // Tilt moves center of mass laterally
    const tiltForce = tiltX * 20;
    
    // Centrifugal force in curves
    const nextTangent = this.trackCurve.getTangent(Math.min(1, this.trackT + 0.005)).normalize();
    const curvatureVec = new THREE.Vector3().subVectors(nextTangent, tangent);
    const curvatureMagnitude = curvatureVec.length() * this.forwardSpeed * 0.8;
    const centrifugalDir = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const centrifugalForce = curvatureMagnitude;

    // Net lateral force
    const netLateralForce = tiltForce - centrifugalForce * Math.sign(curvatureVec.dot(right));
    
    // Traction (less at high speed)
    const tractionFactor = this.isGrounded ? Math.max(0.2, 1 - this.forwardSpeed / 100 * 0.6) : 0.1;
    
    // Apply lateral movement
    this.lateralVelocity += netLateralForce * tractionFactor * dt;
    this.lateralVelocity *= 0.92; // Damping
    this.lateralOffset += this.lateralVelocity * dt;

    // Clamp to track width
    const maxOffset = trackWidth - 0.5;
    if (Math.abs(this.lateralOffset) > maxOffset) {
      this.lateralOffset = Math.sign(this.lateralOffset) * maxOffset;
      this.lateralVelocity *= -0.3; // Bounce
      this.bugWobble = Math.min(2, this.bugWobble + 0.5);
      this.wobblePhase = 0;
    }

    // Vertical physics (jumping/falling)
    if (this.controls.state.jump && this.isGrounded) {
      this.verticalVelocity = 14;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.verticalVelocity -= 25 * dt; // Gravity
      this.heightAboveTrack += this.verticalVelocity * dt;

      // Air control (reduced)
      this.lateralVelocity += tiltX * 5 * dt;
    } else {
      this.heightAboveTrack = 0;
      this.verticalVelocity = 0;
    }

    // Check if landing
    if (this.heightAboveTrack <= 0 && !this.isGrounded) {
      this.isGrounded = true;
      this.heightAboveTrack = 0;
      
      // Landing impact
      const impact = Math.abs(this.verticalVelocity);
      if (impact > 2) {
        this.bugSquash = Math.max(0.5, 1 - impact * 0.05);
        if (impact < 8) {
          this.state.perfectLandings++;
          this.state.perfectRoll = true;
          setTimeout(() => { this.state.perfectRoll = false; }, 600);
        }
        this.bugWobble = Math.min(2, impact * 0.1);
        this.wobblePhase = 0;
      }
      this.verticalVelocity = 0;
    }

    // Wobble from losing traction
    if (Math.abs(this.lateralOffset) > maxOffset * 0.8 && this.isGrounded) {
      this.bugWobble = Math.min(3, this.bugWobble + dt * 3);
      this.wobblePhase += dt * 15;
    }

    // Wobble decay
    if (Math.abs(this.lateralOffset) < maxOffset * 0.5) {
      this.bugWobble *= 0.95;
    }

    // Update physics body position
    const bugPos = point.clone()
      .add(right.clone().multiplyScalar(this.lateralOffset))
      .add(up.clone().multiplyScalar(0.8 + this.heightAboveTrack));
    
    this.bugBody.position.set(bugPos.x, bugPos.y, bugPos.z);
    this.bugBody.velocity.set(0, 0, 0); // We control position directly

    // Checkpoints
    for (const cp of this.checkpoints) {
      if (cp.index > this.state.currentCheckpoint && this.trackT >= cp.t) {
        this.state.currentCheckpoint = cp.index;
      }
    }

    // Finish
    if (this.trackT >= 0.98) {
      this.state.isFinished = true;
      this.state.isRunning = false;
      if (!this.state.bestTime || this.state.time < this.state.bestTime) {
        this.state.bestTime = this.state.time;
      }
    }

    // Fall detection
    if (bugPos.y < -30) {
      this.respawnAtCheckpoint();
    }

    this.wasGrounded = this.isGrounded;
  }

  private respawnAtCheckpoint() {
    const cp = this.checkpoints[this.state.currentCheckpoint];
    this.trackT = cp.t;
    this.lateralOffset = 0;
    this.lateralVelocity = 0;
    this.verticalVelocity = 0;
    this.heightAboveTrack = 0;
    this.forwardSpeed = this.baseSpeed;
    this.isGrounded = true;
  }

  private updateBugVisuals(dt: number) {
    const point = this.trackCurve.getPoint(this.trackT);
    const tangent = this.trackCurve.getTangent(this.trackT).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Handle walking/rolling transition based on flick
    if (this.controls.state.flickDetected && this.controls.state.flickStrength > 0.5) {
      this.isWalking = false;
      this.isRolling = true;
    }
    
    // Smooth transition
    const targetRoll = this.isRolling ? 1 : 0;
    this.rollTransition += (targetRoll - this.rollTransition) * dt * 3;

    // Position
    const bugPos = point.clone()
      .add(right.clone().multiplyScalar(this.lateralOffset))
      .add(up.clone().multiplyScalar(0.8 + this.heightAboveTrack));
    
    this.bugMesh.position.copy(bugPos);

    // Orientation - look along track
    const lookTarget = bugPos.clone().add(tangent.clone().multiplyScalar(5));
    this.bugMesh.lookAt(lookTarget);

    // Lean into turns
    const leanAngle = -this.controls.state.tiltX * 0.3;
    this.bugMesh.rotateZ(leanAngle);

    // Leg animation (more visible when walking, hidden when rolling)
    this.legTime += dt * (4 + this.forwardSpeed * 0.3);
    const legVisibility = 1 - this.rollTransition; // Legs visible when walking
    for (let i = 0; i < this.bugLegs.length; i++) {
      const leg = this.bugLegs[i];
      const phase = i * 0.6;
      const scramble = this.forwardSpeed > 30 ? 2.5 : 1;
      leg.rotation.x = Math.sin(this.legTime * 2 + phase) * 0.4 * scramble * legVisibility;
      leg.position.y = -0.35 + Math.abs(Math.sin(this.legTime * 2 + phase)) * 0.08 * scramble * legVisibility;
      // Tuck legs in when rolling
      leg.scale.setScalar(legVisibility);
    }

    // Squash/stretch
    this.bugSquash += (1 - this.bugSquash) * dt * 8;
    this.bugTargetSquash += (1 - this.bugTargetSquash) * dt * 5;
    this.bugMesh.scale.set(
      0.9 * (2 - this.bugSquash),
      0.9 * this.bugSquash,
      0.9 * (2 - this.bugSquash)
    );

    // Rolling state - curl into ball
    if (this.rollTransition > 0.1) {
      this.bugMesh.rotateX(dt * this.forwardSpeed * 0.15);
      for (const seg of this.bugSegments) {
        const targetScale = new THREE.Vector3(
          1 + 0.3 * this.rollTransition,
          1 + 0.3 * this.rollTransition,
          1 - 0.3 * this.rollTransition
        );
        seg.scale.lerp(targetScale, dt * 6);
      }
    } else {
      for (const seg of this.bugSegments) {
        seg.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 6);
      }
    }

    // Rattling effect on bug mesh (spray can shake)
    const bugRattle = this.rattleIntensity * (0.3 + Math.min(1, this.forwardSpeed / 50) * 0.7);
    this.bugMesh.position.x += Math.sin(this.rattleTime * 1.5) * bugRattle * 2;
    this.bugMesh.position.y += Math.cos(this.rattleTime * 1.8) * bugRattle * 2;

    // Wobble
    if (this.bugWobble > 0.01) {
      this.wobblePhase += dt * 12;
      const wobbleAngle = this.bugWobble * Math.sin(this.wobblePhase) * Math.exp(-this.wobblePhase * 0.1);
      this.bugMesh.rotateZ(wobbleAngle * 0.2);
      this.bugWobble *= 0.98;
    }
  }

  private updateCamera(dt: number) {
    const point = this.trackCurve.getPoint(this.trackT);
    const tangent = this.trackCurve.getTangent(this.trackT).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

    // Bug position
    const bugPos = point.clone()
      .add(right.clone().multiplyScalar(this.lateralOffset))
      .add(new THREE.Vector3(0, 0.8 + this.heightAboveTrack, 0));

    // Camera offset
    const speedFactor = this.forwardSpeed / 80;
    const pullBack = 7 + speedFactor * 5;
    const height = 3 + speedFactor * 2;

    const targetCamPos = bugPos.clone()
      .sub(tangent.clone().multiplyScalar(pullBack))
      .add(new THREE.Vector3(0, height, 0))
      .add(right.clone().multiplyScalar(this.controls.state.tiltX * 2));

    // Smooth follow
    this.cameraPos.lerp(targetCamPos, dt * 4);
    this.camera.position.copy(this.cameraPos);

    // Look target
    const targetLookAt = bugPos.clone()
      .add(tangent.clone().multiplyScalar(6))
      .add(right.clone().multiplyScalar(this.controls.state.tiltX * 2));
    
    this.cameraLookAt.lerp(targetLookAt, dt * 5);
    this.camera.lookAt(this.cameraLookAt);

    // Dynamic FOV
    const targetFOV = 65 + speedFactor * 20;
    this.camera.fov += (targetFOV - this.camera.fov) * dt * 3;
    this.camera.updateProjectionMatrix();

    // Rattling/shaking effect (spray can feel)
    this.rattleTime += dt * 30; // High frequency
    const rattleX = Math.sin(this.rattleTime * 1.3) * this.rattleIntensity;
    const rattleY = Math.cos(this.rattleTime * 1.7) * this.rattleIntensity;
    const rattleZ = Math.sin(this.rattleTime * 2.1) * this.rattleIntensity * 0.5;
    
    // Intensity increases with speed
    const speedRattle = Math.min(1, this.forwardSpeed / 60);
    const totalRattle = this.rattleIntensity * (0.5 + speedRattle * 1.5);
    
    this.camera.position.x += rattleX * totalRattle * 10;
    this.camera.position.y += rattleY * totalRattle * 10;
    this.camera.position.z += rattleZ * totalRattle * 5;
  }

  private onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
