/**
 * A small WebGPU-rendered particle burst layered on top of the SVG
 * character, for effects CSS can't easily do (confetti on success).
 * Uses Three.js's WebGPURenderer, which falls back to WebGL2
 * automatically on hardware/drivers that don't support WebGPU yet.
 */
import * as THREE from '../../node_modules/three/build/three.webgpu.js';

const SIZE = 160;
const HALF = SIZE / 2;
const GRAVITY = 260;
const COLORS = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff];

let renderer;
let scene;
let camera;
let particles = [];
let lastFrame = performance.now();
let ready = false;

export async function initParticles(canvas) {
  camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 100);
  camera.position.z = 10;

  scene = new THREE.Scene();

  renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  await renderer.init();
  console.log('[particles] renderer backend:', renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL');

  ready = true;
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
  lastFrame = now;
  if (!ready || particles.length === 0) return;

  particles = particles.filter((p) => {
    p.age += dt;
    if (p.age >= p.life) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      return false;
    }
    p.velocity.y -= GRAVITY * dt;
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.material.opacity = 1 - p.age / p.life;
    return true;
  });

  renderer.render(scene, camera);
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
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, originY, 1);
    scene.add(mesh);

    particles.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed * 0.8 + 40, 0),
      spin: (Math.random() - 0.5) * 10,
      age: 0,
      life: 0.7 + Math.random() * 0.5,
    });
  }
}
