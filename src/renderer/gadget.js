/**
 * A glassy handheld-console character: a frosted rounded-box shell with a
 * D-pad, a button, and a screen that shows a small procedural face (drawn
 * to a canvas and used as a texture, the same way a real device's screen
 * would render a sprite). Its signature trait, borrowed from the raymarched
 * glass gadget this was modeled after, is that its gaze drifts toward the
 * cursor while idle.
 */
import * as THREE from '../../node_modules/three/build/three.webgpu.js';
import { RoundedBoxGeometry } from '../../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SIZE = 160;

let renderer;
let scene;
let camera;
let shell;
let face;
let faceCanvas;
let faceCtx;
let faceTexture;
let ready = false;
let lastFrame = performance.now();
let state = 'idle';
let stateStartedAt = 0;
let blinkAt = 0;
let lookX = 0;
let lookY = 0;

const GLOW_COLORS = {
  idle: '#7de0c0',
  greet: '#7de0c0',
  working: '#9a6fd8',
  success: '#7de0c0',
  error: '#f2879b',
  goodbye: '#7de0c0',
  poke: '#f0c76f',
};

export async function initGadget(canvas) {
  camera = new THREE.PerspectiveCamera(30, 1, 1, 500);
  camera.position.set(0, 6, 190);
  camera.lookAt(0, 0, 0);

  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(40, 60, 90);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb98fe8, 0.4);
  rim.position.set(-50, 20, -40);
  scene.add(rim);

  shell = new THREE.Group();
  scene.add(shell);

  buildBody();
  buildScreen();
  buildControls();

  renderer = new THREE.WebGPURenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  await renderer.init();

  ready = true;
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

function buildBody() {
  const geometry = new RoundedBoxGeometry(34, 50, 12, 4, 5);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf3effc,
    transparent: true,
    opacity: 0.55,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    emissive: 0x9a6fd8,
    emissiveIntensity: 0.06,
  });
  const body = new THREE.Mesh(geometry, material);
  shell.add(body);

  // The little raised nub on top edge, seen on the reference device.
  const nub = new THREE.Mesh(
    new THREE.SphereGeometry(2, 12, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xf3effc, transparent: true, opacity: 0.6, roughness: 0.2 })
  );
  nub.position.set(10, 26, 0);
  shell.add(nub);
}

function buildScreen() {
  // A dark bezel plate sits slightly proud of the glass front face, and the
  // face texture sits in front of that, matching how a real screen reads as
  // the frontmost surface inside the case rather than something carved out
  // of it (no CSG available here).
  const plate = new THREE.Mesh(
    new RoundedBoxGeometry(24, 28, 2, 3, 2),
    new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.5, transparent: true, opacity: 1 })
  );
  plate.position.set(0, 9, 6.4);
  shell.add(plate);

  faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 154;
  faceCtx = faceCanvas.getContext('2d');
  faceTexture = new THREE.CanvasTexture(faceCanvas);

  face = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 24),
    new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, opacity: 1, depthTest: false })
  );
  face.position.set(0, 9, 7.5);
  face.renderOrder = 1;
  shell.add(face);
}

function buildControls() {
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2534, roughness: 0.5, transparent: true, opacity: 1 });
  const dpadX = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 2), darkMat);
  dpadX.position.set(-9, -15, 6.5);
  const dpadY = new THREE.Mesh(new THREE.BoxGeometry(3, 9, 2), darkMat);
  dpadY.position.set(-9, -15, 6.5);
  shell.add(dpadX, dpadY);

  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 2, 20),
    new THREE.MeshStandardMaterial({ color: 0xf0a35a, roughness: 0.4, transparent: true, opacity: 1, emissive: 0xf0a35a, emissiveIntensity: 0.2 })
  );
  button.rotation.x = Math.PI / 2;
  button.position.set(9, -15, 6.5);
  shell.add(button);

  const grilleMat = new THREE.MeshStandardMaterial({ color: 0x3a3446, roughness: 0.6, transparent: true, opacity: 1 });
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1.5), grilleMat);
    bar.position.set(10, 21 - i * 2.4, 6.4);
    shell.add(bar);
  }
}

function drawFace(mood, blink) {
  const ctx = faceCtx;
  const w = faceCanvas.width;
  const h = faceCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = GLOW_COLORS[mood] ?? GLOW_COLORS.idle;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 14;

  const cx = w / 2;
  const eyeY = h * 0.42;
  const eyeDx = 26;

  const drawCaretEye = (x, flip) => {
    ctx.beginPath();
    ctx.moveTo(x - 10, eyeY + 6 * flip);
    ctx.lineTo(x, eyeY - 6 * flip);
    ctx.lineTo(x + 10, eyeY + 6 * flip);
    ctx.stroke();
  };

  const drawFlatEye = (x) => {
    ctx.beginPath();
    ctx.moveTo(x - 11, eyeY);
    ctx.lineTo(x + 11, eyeY);
    ctx.stroke();
  };

  const drawRoundEye = (x, r) => {
    ctx.beginPath();
    ctx.arc(x, eyeY, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawSleepyEye = (x) => {
    ctx.beginPath();
    ctx.arc(x, eyeY + 4, 11, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  };

  if (blink && (mood === 'idle' || mood === 'greet' || mood === 'success')) {
    drawFlatEye(cx - eyeDx);
    drawFlatEye(cx + eyeDx);
  } else if (mood === 'error') {
    drawRoundEye(cx - eyeDx, 9);
    drawRoundEye(cx + eyeDx, 9);
  } else if (mood === 'working') {
    drawFlatEye(cx - eyeDx);
    drawFlatEye(cx + eyeDx);
  } else if (mood === 'goodbye') {
    drawSleepyEye(cx - eyeDx);
    drawSleepyEye(cx + eyeDx);
  } else if (mood === 'poke') {
    drawRoundEye(cx - eyeDx, 11);
    drawRoundEye(cx + eyeDx, 11);
    // A little sparkle burst, since this state is "a bit too excited".
    ctx.lineWidth = 4;
    [-1, 1].forEach((side) => {
      const x = cx + side * (eyeDx + 16);
      ctx.beginPath();
      ctx.moveTo(x - 6, eyeY - 14);
      ctx.lineTo(x + 6, eyeY - 14);
      ctx.moveTo(x, eyeY - 20);
      ctx.lineTo(x, eyeY - 8);
      ctx.stroke();
    });
    ctx.lineWidth = 8;
  } else {
    drawCaretEye(cx - eyeDx, 1);
    drawCaretEye(cx + eyeDx, 1);
  }

  const mouthY = h * 0.66;
  ctx.beginPath();
  if (mood === 'error') {
    ctx.moveTo(cx - 14, mouthY + 4);
    ctx.lineTo(cx + 14, mouthY + 4);
  } else if (mood === 'greet' || mood === 'success') {
    ctx.arc(cx, mouthY - 10, 16, Math.PI * 0.15, Math.PI * 0.85);
  } else if (mood === 'poke') {
    ctx.arc(cx, mouthY, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'working') {
    ctx.moveTo(cx - 8, mouthY);
    ctx.lineTo(cx + 8, mouthY);
  } else if (mood === 'goodbye') {
    ctx.arc(cx, mouthY - 4, 8, Math.PI * 0.2, Math.PI * 0.8);
  } else {
    ctx.arc(cx, mouthY - 8, 12, Math.PI * 0.15, Math.PI * 0.85);
  }
  if (mood !== 'poke') ctx.stroke();

  faceTexture.needsUpdate = true;
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!ready) return;
  const elapsed = now / 1000;
  lastFrame = now;

  animateShell(elapsed);
  animateFace(elapsed);

  renderer.render(scene, camera);
}

function speedForState() {
  switch (state) {
    case 'working':
      return 5;
    case 'success':
    case 'poke':
      return 6;
    case 'error':
      return 8;
    default:
      return 1.4;
  }
}

function animateShell(elapsed) {
  const sinceState = elapsed - stateStartedAt;
  const bob = Math.sin(elapsed * speedForState()) * (state === 'idle' ? 1.5 : 2.5);
  shell.position.y = bob;

  // Gaze drift toward the cursor is this character's signature trait, but
  // only while it isn't already busy expressing a reaction.
  const trackCursor = state === 'idle' || state === 'working';
  const targetRotY = trackCursor ? lookX * 0.35 : 0;
  const targetRotX = trackCursor ? -lookY * 0.2 : 0;

  let extraRotZ = 0;
  let extraScale = 1;
  if (state === 'error') {
    extraRotZ = Math.sin(sinceState * 30) * Math.max(0.12 - sinceState * 0.08, 0);
  }
  if (state === 'success' || state === 'poke' || state === 'greet') {
    const pop = Math.max(1 - sinceState * 2.2, 0);
    extraScale = 1 + pop * 0.12;
    extraRotZ = Math.sin(sinceState * 14) * pop * 0.1;
  }
  if (state === 'goodbye') {
    const settle = Math.min(sinceState / 1.2, 1);
    shell.position.y -= settle * 3;
    shell.scale.setScalar(1 - settle * 0.08);
  } else {
    shell.scale.setScalar(extraScale);
  }

  shell.rotation.y += (targetRotY - shell.rotation.y) * 0.08;
  shell.rotation.x += (targetRotX - shell.rotation.x) * 0.08;
  shell.rotation.z = extraRotZ;
}

function animateFace(elapsed) {
  const blink = state === 'idle' && Math.sin(elapsed * 0.5 + 1.7) > 0.985;
  if (blink !== animateFace.lastBlink || state !== animateFace.lastState) {
    drawFace(state, blink);
    animateFace.lastBlink = blink;
    animateFace.lastState = state;
  }
}

export function setGadgetState(nextState) {
  state = nextState;
  stateStartedAt = performance.now() / 1000;
}

/** nx, ny: cursor position relative to the character, each roughly -1..1. */
export function setGadgetLook(nx, ny) {
  lookX = Math.max(-1, Math.min(1, nx));
  lookY = Math.max(-1, Math.min(1, ny));
}
