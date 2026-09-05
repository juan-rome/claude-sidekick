const stage = document.getElementById('stage');
const characters = document.querySelectorAll('.character');

let currentState = 'idle';
let pokeRevertTimer = null;
const POKE_HOLD_MS = 1500;

function setState(state) {
  currentState = state;
  stage.className = `state-${state}`;
}

function setCharacter(character) {
  characters.forEach((el) => {
    el.classList.toggle('active', el.id === `char-${character}`);
  });
}

function handlePoke() {
  setState('poke');
  if (pokeRevertTimer) clearTimeout(pokeRevertTimer);
  pokeRevertTimer = setTimeout(() => {
    // Only settle back down if a real hook event hasn't taken over since.
    if (currentState === 'poke') setState('idle');
  }, POKE_HOLD_MS);
}

let greetRevertTimer = null;
function handleGreet() {
  setState('greet');
  if (greetRevertTimer) clearTimeout(greetRevertTimer);
  greetRevertTimer = setTimeout(() => {
    if (currentState === 'greet') setState('idle');
  }, POKE_HOLD_MS);
}

/**
 * Dragging is handled manually rather than via -webkit-app-region: drag,
 * because a drag region swallows click events outright, which is why a
 * plain CSS drag region and a click-to-poke listener can't coexist.
 * mousedown starts tracking; if the pointer moves past DRAG_THRESHOLD
 * before mouseup, it's a drag (forwarded to main to move the window);
 * otherwise it's a poke.
 */
const DRAG_THRESHOLD = 4;
let dragState = null;

stage.addEventListener('mousedown', (event) => {
  dragState = { startX: event.screenX, startY: event.screenY, moved: false };
  window.sidekick.dragStart();
});

window.addEventListener('mousemove', (event) => {
  if (!dragState) return;
  const dx = event.screenX - dragState.startX;
  const dy = event.screenY - dragState.startY;
  if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    dragState.moved = true;
  }
  if (dragState.moved) {
    window.sidekick.dragMove(dx, dy);
  }
});

window.addEventListener('mouseup', () => {
  if (!dragState) return;
  if (!dragState.moved) {
    handlePoke();
  }
  window.sidekick.dragEnd();
  dragState = null;
});

/**
 * Shaking the cursor over the character (rapidly waggling it back and
 * forth, no click needed) also gets its attention, reusing the same
 * greet reaction as a hello. Tracked as total path length covered in a
 * short rolling window, since a shake covers much more ground than a
 * normal hover/mouse-over-to-read pass.
 */
const SHAKE_WINDOW_MS = 500;
const SHAKE_DISTANCE_PX = 220;
const SHAKE_COOLDOWN_MS = 3000;
let shakeSamples = [];
let lastShakeAt = 0;

stage.addEventListener('mousemove', (event) => {
  if (dragState) return; // dragging the window isn't a shake
  const now = performance.now();
  shakeSamples.push({ x: event.screenX, y: event.screenY, t: now });
  shakeSamples = shakeSamples.filter((sample) => now - sample.t <= SHAKE_WINDOW_MS);

  let distance = 0;
  for (let i = 1; i < shakeSamples.length; i++) {
    distance += Math.hypot(
      shakeSamples[i].x - shakeSamples[i - 1].x,
      shakeSamples[i].y - shakeSamples[i - 1].y
    );
  }

  if (distance > SHAKE_DISTANCE_PX && now - lastShakeAt > SHAKE_COOLDOWN_MS) {
    lastShakeAt = now;
    shakeSamples = [];
    handleGreet();
  }
});

window.sidekick.onState(setState);
window.sidekick.onCharacter(setCharacter);
