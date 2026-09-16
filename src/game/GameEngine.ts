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
}

// Track curve points for "Backyard Run"
function createTrackCurve(): THREE.CatmullRomCurve3 {
  const s = 6; // scale factor
  const points = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, -8 * s),
    new THREE.Vector3(3 * s, 1.5, -14 * s),
    new THREE.Vector3(8 * s, 2, -16 * s),
    new THREE.Vector3(12 * s, 2.5, -13 * s),
    new THREE.Vector3(14 * s, 3, -8 * s),
    // Jump ramp
    new THREE.Vector3(13 * s, 4.5, -4 * s),
    new THREE.Vector3(11 * s, 3, -1 * s),
    // Narrow branch
    new THREE.Vector3(8 * s, 3, 1 * s),
    new THREE.Vector3(4 * s, 3.5, 3 * s),
    // Banked turn
    new THREE.Vector3(0, 4, 6 * s),
    new THREE.Vector3(-4 * s, 5, 9 * s),
    new THREE.Vector3(-7 * s, 6, 7 * s),
    // Loop
    new THREE.Vector3(-8 * s, 9, 3 * s),
    new THREE.Vector3(-7 * s, 14, 0),
    new THREE.Vector3(-5 * s, 17, -2 * s),
    new THREE.Vector3(-3 * s, 14, -3 * s),
    new THREE.Vector3(-1 * s, 9, -1 * s),
    // Wide section (hula roll)
    new THREE.Vector3(2 * s, 7, 2 * s),
    new THREE.Vector3(5 * s, 6, 5 * s),
    // Downhill
    new THREE.Vector3(8 * s, 4, 8 * s),
    new THREE.Vector3(12 * s, 2, 11 * s),
    new THREE.Vector3(16 * s, 1, 13 * s),
    // Finish
    new THREE.Vector3(20 * s, 1, 14 * s),
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
  };

  // Movement state
  private trackT = 0; // position along track (0-1)
  private lateralOffset = 0; // offset from track center
  private lateralVelocity = 0;
  private verticalVelocity = 0;
  private heightAboveTrack = 0;
  private forwardSpeed = 0;
  private baseSpeed = 20;
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

  // Particles
  private speedParticles!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleVelocities: number[] = [];
  private particleLifetimes: number[] = [];
  private maxParticles = 100;

  // Checkpoint markers
  private checkpointMarkers: THREE.Mesh[] = [];
  private finishMarker!: THREE.Group;

  // Callbacks
  onStateChange?: (state: GameState) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.init();
  }

  private init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.appendChild(this.renderer.domElement);

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
    const trackWidth = 4;
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

      // Width variation
      let w = trackWidth;
      if (t > 0.33 && t < 0.40) w = 2; // Narrow
      if (t > 0.58 && t < 0.68) w = 6; // Wide

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
      
      let w = 4;
      if (t > 0.33 && t < 0.40) w = 2;
      if (t > 0.58 && t < 0.68) w = 6;

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
      marker.position.y = this.trackCurve.getPoint(this.checkpoints[i].t).y + 0.5 + Math.sin(time * 2 + i) * 0.2;
      
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
    if (this.finishMarker) {
      this.finishMarker.children[0].position.y = 
        this.trackCurve.getPoint(0.97).y + 0.5 + Math.sin(time * 3) * 0.15;
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

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
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

    // Step physics (for ground collision only)
    this.world.step(1 / 60, dt, 3);

    this.renderer.render(this.scene, this.camera);

    this.state.speed = this.forwardSpeed;
    this.state.countdown = this.countdown;
    this.onStateChange?.({ ...this.state });
  }

  private updatePhysics(dt: number) {
    const tiltX = this.controls.state.tiltX;
    const tiltY = this.controls.state.tiltY;

    // Forward speed management
    let targetSpeed = this.baseSpeed;
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
    let trackWidth = 4;
    if (this.trackT > 0.33 && this.trackT < 0.40) trackWidth = 2;
    if (this.trackT > 0.58 && this.trackT < 0.68) trackWidth = 6;

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

    // Leg animation
    this.legTime += dt * (4 + this.forwardSpeed * 0.3);
    for (let i = 0; i < this.bugLegs.length; i++) {
      const leg = this.bugLegs[i];
      const phase = i * 0.6;
      const scramble = this.forwardSpeed > 30 ? 2.5 : 1;
      leg.rotation.x = Math.sin(this.legTime * 2 + phase) * 0.4 * scramble;
      leg.position.y = -0.35 + Math.abs(Math.sin(this.legTime * 2 + phase)) * 0.08 * scramble;
    }

    // Squash/stretch
    this.bugSquash += (1 - this.bugSquash) * dt * 8;
    this.bugTargetSquash += (1 - this.bugTargetSquash) * dt * 5;
    this.bugMesh.scale.set(
      0.9 * (2 - this.bugSquash),
      0.9 * this.bugSquash,
      0.9 * (2 - this.bugSquash)
    );

    // Rolling state
    if (this.isRolling) {
      this.bugMesh.rotateX(dt * this.forwardSpeed * 0.15);
      for (const seg of this.bugSegments) {
        seg.scale.lerp(new THREE.Vector3(1.3, 1.3, 0.7), dt * 6);
      }
    } else {
      for (const seg of this.bugSegments) {
        seg.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 6);
      }
    }

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

    // Subtle camera shake at high speed
    if (this.forwardSpeed > 40) {
      const intensity = (this.forwardSpeed - 40) / 60 * 0.08;
      this.camera.position.x += (Math.random() - 0.5) * intensity;
      this.camera.position.y += (Math.random() - 0.5) * intensity;
    }
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
