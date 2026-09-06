/**
 * A jellyfish character rendered entirely with Three.js's WebGPURenderer
 * instead of SVG/CSS: a translucent, glowing bell (procedurally built
 * from half a sphere, no external 3D model needed) that pulses like a
 * real jelly swimming, with a handful of tentacles that sway via a
 * per-frame recomputed wave curve. Simple flat circle "eyes" on the bell
 * keep it consistent with the rest of the roster's expressiveness.
 */
import * as THREE from '../../node_modules/three/build/three.webgpu.js';

const SIZE = 160;
const TENTACLE_COUNT = 6;
const TENTACLE_LENGTH = 46;
const TENTACLE_SEGMENTS = 10;

let renderer;
let scene;
let camera;
let bell;
let eyeL;
let eyeR;
let tentacles = [];
let ready = false;
let lastFrame = performance.now();
let state = 'idle';
let stateStartedAt = 0;

const BELL_COLOR = 0xc9a7f0;
const GLOW_COLORS = {
  idle: 0x9a6fd8,
  greet: 0xb98fe8,
  working: 0x9a6fd8,
  success: 0x7de0c0,
  error: 0xe07d8f,
  goodbye: 0x9a6fd8,
  poke: 0xf0c76f,
};

export async function initJellyfish(canvas) {
  camera = new THREE.PerspectiveCamera(32, 1, 1, 500);
  camera.position.set(0, 6, 165);
  camera.lookAt(0, -6, 0);

  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(30, 60, 80);
  scene.add(key);

  buildBell();
  buildEyes();
  buildTentacles();

  renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  await renderer.init();
  console.log('[jellyfish] renderer backend:', renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL');

  ready = true;
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

function buildBell() {
  // Top half of a sphere = a rounded dome, exactly the bell shape, with
  // no need for a hand-modeled/sculpted asset.
  const geometry = new THREE.SphereGeometry(34, 32, 20, 0, Math.PI * 2, 0, Math.PI / 1.8);
  const material = new THREE.MeshPhysicalMaterial({
    color: BELL_COLOR,
    transparent: true,
    opacity: 0.55,
    roughness: 0.25,
    metalness: 0,
    emissive: GLOW_COLORS.idle,
    emissiveIntensity: 0.35,
  });
  bell = new THREE.Mesh(geometry, material);
  bell.position.y = 10;
  scene.add(bell);
}

function buildEyes() {
  const eyeGeometry = new THREE.CircleGeometry(3.2, 16);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x2a1c3a, depthTest: false });

  eyeL = new THREE.Mesh(eyeGeometry, eyeMaterial.clone());
  eyeL.position.set(-9, 14, 33);
  eyeR = new THREE.Mesh(eyeGeometry, eyeMaterial.clone());
  eyeR.position.set(9, 14, 33);
  scene.add(eyeL, eyeR);
}

function buildTentacles() {
  const material = new THREE.MeshBasicMaterial({
    color: BELL_COLOR,
    transparent: true,
    opacity: 0.5,
  });

  for (let i = 0; i < TENTACLE_COUNT; i++) {
    const angle = (i / TENTACLE_COUNT) * Math.PI * 2;
    const baseX = Math.cos(angle) * 22;
    const baseZ = Math.sin(angle) * 22;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material.clone());
    scene.add(mesh);
    tentacles.push({ mesh, baseX, baseZ, phase: i * 1.3 });
  }
}

function tentacleCurve(baseX, baseZ, phase, time, sway) {
  const points = [];
  for (let i = 0; i <= TENTACLE_SEGMENTS; i++) {
    const t = i / TENTACLE_SEGMENTS;
    const y = 4 - t * TENTACLE_LENGTH;
    const wave = Math.sin(time * 2.2 + phase + t * 5) * (t * sway);
    points.push(new THREE.Vector3(baseX + wave, y, baseZ));
  }
  return new THREE.CatmullRomCurve3(points);
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!ready) return;
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
  const elapsed = now / 1000;
  lastFrame = now;

  animateBell(elapsed);
  animateTentacles(elapsed);
  animateFace(elapsed);

  renderer.render(scene, camera);
}

function pulseSpeedForState() {
  switch (state) {
    case 'working':
      return 3.4;
    case 'success':
    case 'poke':
      return 4.5;
    case 'error':
      return 1.6;
    case 'goodbye':
      return 1.2;
    default:
      return 2;
  }
}

function animateBell(elapsed) {
  const speed = pulseSpeedForState();
  const pulse = (Math.sin(elapsed * speed) + 1) / 2; // 0..1
  const squish = 1 - pulse * 0.16;
  const flare = 1 + pulse * 0.1;
  bell.scale.set(flare, squish, flare);

  const targetGlow = GLOW_COLORS[state] ?? GLOW_COLORS.idle;
  bell.material.emissive.lerp(new THREE.Color(targetGlow), 0.08);
  bell.material.emissiveIntensity = 0.3 + pulse * 0.35;

  const sinceState = elapsed - stateStartedAt;
  if (state === 'goodbye') {
    const settle = Math.min(sinceState / 1.2, 1);
    bell.position.y = 10 + settle * 3;
    bell.material.opacity = 0.55 * (1 - settle * 0.4);
  } else {
    bell.position.y = 10;
    bell.material.opacity = 0.55;
  }
}

function animateTentacles(elapsed) {
  const sway = state === 'working' ? 10 : state === 'error' ? 3 : 6;
  tentacles.forEach(({ mesh, baseX, baseZ, phase }) => {
    const curve = tentacleCurve(baseX, baseZ, phase, elapsed, sway);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(curve, TENTACLE_SEGMENTS, 1.1, 6, false);
  });
}

function animateFace(elapsed) {
  const blink = state === 'idle' && Math.sin(elapsed * 0.6) > 0.985;

  let scaleY = 1;
  let offsetY = 0;
  if (state === 'success' || state === 'poke') {
    scaleY = 0.2;
    offsetY = 1.5;
  } else if (state === 'error') {
    scaleY = 1.3;
  } else if (blink) {
    scaleY = 0.1;
  }

  [eyeL, eyeR].forEach((eye) => {
    eye.scale.y = scaleY;
    eye.position.y = 14 + offsetY;
  });
}

export function setJellyfishState(nextState) {
  state = nextState;
  stateStartedAt = performance.now() / 1000;
}
