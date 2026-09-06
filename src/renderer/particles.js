/**
 * WebGPU-rendered accents layered on top of the SVG character (works for
 * blob/ghost/bunny alike, since it's one shared canvas over whichever
 * character is active), for effects CSS can't easily do: confetti on
 * success, a poof on poke, worry drops on error, a sparkle trail while
 * working, and a few softly drifting ambient motes at rest. Uses Three.js's
 * WebGPURenderer, which falls back to WebGL2 automatically on hardware
 * that doesn't support WebGPU yet.
 */
import * as THREE from '../../node_modules/three/build/three.webgpu.js';

const SIZE = 160;
const HALF = SIZE / 2;
const GRAVITY = 260;
const CONFETTI_COLORS = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff];

let renderer;
let scene;
let camera;
let bursts = [];
let ambientMotes = [];
let lastFrame = performance.now();
let lastSparkleAt = 0;
let ready = false;
let currentState = 'idle';

export async function initParticles(canvas) {
  camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 100);
  camera.position.z = 10;

  scene = new THREE.Scene();

  renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  await renderer.init();
  console.log('[particles] renderer backend:', renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL');

  buildAmbientMotes();

  ready = true;
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

/** Called whenever the character's state changes, so ambient motes can
 *  stand down during busier reactions and 'working' can keep a sparkle
 *  trail going for as long as it lasts (not a one-shot burst). */
export function setParticleState(state) {
  currentState = state;
  if (state === 'poke') spawnPoof();
  if (state === 'error') spawnWorryDrops();
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
  lastFrame = now;
  if (!ready) return;

  updateAmbientMotes(now / 1000, dt);
  if (currentState === 'working') maybeSpawnSparkle(now);
  updateBursts(dt);

  renderer.render(scene, camera);
}

function updateBursts(dt) {
  if (bursts.length === 0) return;
  bursts = bursts.filter((p) => {
    p.age += dt;
    if (p.age >= p.life) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      return false;
    }
    if (p.gravity) p.velocity.y -= GRAVITY * dt;
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    if (p.spin) p.mesh.rotation.z += p.spin * dt;
    if (p.grow) p.mesh.scale.setScalar(1 + (p.age / p.life) * p.grow);
    p.mesh.material.opacity = p.baseOpacity * (1 - p.age / p.life);
    return true;
  });
}

/** originY: where in the 160-unit stage (0 = center) the burst starts,
 *  e.g. a small negative value to burst from around the character's face. */
export function burst(originY = -10) {
  if (!ready) return;

  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 70;
    const geometry = new THREE.CircleGeometry(1.5 + Math.random() * 2, 8);
    const material = new THREE.MeshBasicMaterial({
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, originY, 1);
    scene.add(mesh);

    bursts.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed * 0.8 + 40, 0),
      spin: (Math.random() - 0.5) * 10,
      gravity: true,
      baseOpacity: 1,
      age: 0,
      life: 0.7 + Math.random() * 0.5,
    });
  }
}

/** A soft gray puff that expands and fades, like a cartoon "poof". */
function spawnPoof() {
  if (!ready) return;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 12 + Math.random() * 10;
    const geometry = new THREE.CircleGeometry(4 + Math.random() * 2, 12);
    const material = new THREE.MeshBasicMaterial({
      color: 0xd8d4e0,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, -6, 1);
    scene.add(mesh);

    bursts.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0),
      gravity: false,
      grow: 1.4,
      baseOpacity: 0.7,
      age: 0,
      life: 0.45 + Math.random() * 0.15,
    });
  }
}

/** A couple of small blue drops falling from near the top of the
 *  character, the classic "worried" tell. */
function spawnWorryDrops() {
  if (!ready) return;
  const count = 2;
  for (let i = 0; i < count; i++) {
    const x = (i === 0 ? -1 : 1) * (14 + Math.random() * 6);
    const geometry = new THREE.CircleGeometry(2.2, 10);
    const material = new THREE.MeshBasicMaterial({
      color: 0x6fb8e8,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 30, 1);
    scene.add(mesh);

    bursts.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 6, -55, 0),
      gravity: false,
      baseOpacity: 0.9,
      age: 0,
      life: 0.6,
    });
  }
}

const SPARKLE_INTERVAL_MS = 220;

function maybeSpawnSparkle(now) {
  if (now - lastSparkleAt < SPARKLE_INTERVAL_MS) return;
  lastSparkleAt = now;

  const angle = Math.random() * Math.PI * 2;
  const radius = 34 + Math.random() * 10;
  const geometry = new THREE.CircleGeometry(1.4, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff3b0,
    transparent: true,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 1);
  scene.add(mesh);

  bursts.push({
    mesh,
    velocity: new THREE.Vector3(0, 14, 0),
    gravity: false,
    baseOpacity: 1,
    age: 0,
    life: 0.5,
  });
}

const AMBIENT_COUNT = 7;

function buildAmbientMotes() {
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const geometry = new THREE.CircleGeometry(0.9 + Math.random() * 1.1, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    ambientMotes.push({
      mesh,
      baseX: (Math.random() - 0.5) * 100,
      baseY: (Math.random() - 0.5) * 100,
      radius: 6 + Math.random() * 10,
      speed: 0.15 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      maxOpacity: 0.25 + Math.random() * 0.25,
    });
  }
}

function updateAmbientMotes(elapsed, dt) {
  // Visible while idle/working/question (calm states); fade out for
  // busier reactions so they don't compete with a burst/trail/drops.
  const shouldShow = currentState === 'idle' || currentState === 'working' || currentState === 'question';

  ambientMotes.forEach((m) => {
    const target = shouldShow ? m.maxOpacity : 0;
    m.mesh.material.opacity += (target - m.mesh.material.opacity) * Math.min(dt * 3, 1);
    m.mesh.position.x = m.baseX + Math.cos(elapsed * m.speed + m.phase) * m.radius;
    m.mesh.position.y = m.baseY + Math.sin(elapsed * m.speed * 1.3 + m.phase) * m.radius;
    m.mesh.position.z = 1;
  });
}
