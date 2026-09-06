import { initParticles, burst, setParticleState } from './particles.js';
import { initJellyfish, setJellyfishState } from './jellyfish.js';
import { initGadget, setGadgetState, setGadgetLook } from './gadget.js';

const stage = document.getElementById('stage');
const characters = document.querySelectorAll('.character');
const effectsCanvas = document.getElementById('effects-canvas');
const jellyfishCanvas = document.getElementById('char-jellyfish');
const gadgetCanvas = document.getElementById('char-gadget');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');

initParticles(effectsCanvas);
initJellyfish(jellyfishCanvas);
initGadget(gadgetCanvas);

let currentState = 'idle';
let pokeRevertTimer = null;
const POKE_HOLD_MS = 1500;

/** No line for idle/working: idle is the resting state (a bubble there
 *  would just be noise), and working now covers every tool call (both
 *  Pre- and PostToolUse), so giving it a line would mean one popping up
 *  constantly while a session runs. No line for success either, since
 *  the confetti and happy face already say it without needing a "Done!"
 *  on top. Every other, occasional state gets a one-word reaction,
 *  including question, which just holds up its line for as long as the
 *  state itself holds. */
const BUBBLE_TEXT = {
  greet: 'Hi!',
  error: 'Oops!',
  question: 'What do you think?',
  goodbye: 'Bye!',
  poke: 'Hehe!',
};

let bubblesEnabled = true;

function updateBubble(state) {
  const text = bubblesEnabled ? BUBBLE_TEXT[state] : null;
  if (text) {
    bubbleText.textContent = text;
    speechBubble.classList.add('visible');
  } else {
    speechBubble.classList.remove('visible');
  }
}

function setState(state) {
  currentState = state;
  stage.className = `state-${state}`;
  setJellyfishState(state);
  setGadgetState(state);
  setParticleState(state);
  updateBubble(state);
  if (state === 'success') burst();
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

/**
 * A click pokes; a double-click instead brings back whatever app you
 * were using before you clicked the character (Claude Code has no one
 * "window" to target, since it might be Terminal, iTerm, VS Code, or
 * the Claude desktop app). The single-click poke is held back briefly
 * so a second click can cancel it rather than firing both.
 */
const DOUBLE_CLICK_MS = 300;
let clickTimer = null;
let pendingClicks = 0;

function handleClick() {
  pendingClicks += 1;
  if (pendingClicks === 1) {
    clickTimer = setTimeout(() => {
      pendingClicks = 0;
      clickTimer = null;
      handlePoke();
    }, DOUBLE_CLICK_MS);
    return;
  }
  clearTimeout(clickTimer);
  clickTimer = null;
  pendingClicks = 0;
  window.sidekick.bringForward();
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
    handleClick();
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

/**
 * The gadget character's signature trait: its gaze drifts toward the
 * cursor. Harmless to compute even when another character is active,
 * since gadget.js just holds the value until it's next drawn.
 */
stage.addEventListener('mousemove', (event) => {
  const rect = stage.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  setGadgetLook(nx, ny);
});

stage.addEventListener('mouseleave', () => setGadgetLook(0, 0));

window.sidekick.onState(setState);
window.sidekick.onCharacter(setCharacter);
window.sidekick.onShowBubbles((show) => {
  bubblesEnabled = show;
  updateBubble(currentState);
});
