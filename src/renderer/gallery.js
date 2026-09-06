/**
 * The character viewer window: same character modules the real widget
 * uses (imported directly, nothing duplicated), wrapped in manual
 * character/state pickers instead of real hook events, so it doubles as
 * documentation for what each state actually looks like.
 */
import { initParticles, burst, setParticleState } from './particles.js';
import { initJellyfish, setJellyfishState } from './jellyfish.js';
import { initGadget, setGadgetState } from './gadget.js';

const stage = document.getElementById('stage');
const characters = document.querySelectorAll('.character');
const effectsCanvas = document.getElementById('effects-canvas');
const jellyfishCanvas = document.getElementById('char-jellyfish');
const gadgetCanvas = document.getElementById('char-gadget');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const stateLabel = document.getElementById('state-label');

initParticles(effectsCanvas);
initJellyfish(jellyfishCanvas);
initGadget(gadgetCanvas);

// No hook server here to drive real reverts, so this viewer runs its own
// timers with the same hold durations the real one uses.
const HOLD_MS = { poke: 1500, greet: 2500, success: 2500, error: 2500, goodbye: 2500 };
const BUBBLE_TEXT = { greet: 'Hi!', error: 'Oops!', question: 'What do you think?', goodbye: 'Bye!', poke: 'Hehe!' };

let currentState = 'idle';
let revertTimer = null;

function updateBubble(state) {
  const text = BUBBLE_TEXT[state];
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
  stateLabel.textContent = state;
  setJellyfishState(state);
  setGadgetState(state);
  setParticleState(state);
  updateBubble(state);
  if (state === 'success') burst();

  document.querySelectorAll('#state-row .chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.state === state));
  });

  if (revertTimer) clearTimeout(revertTimer);
  const hold = HOLD_MS[state];
  if (hold) {
    revertTimer = setTimeout(() => {
      if (currentState === state) setState('idle');
    }, hold);
  }
}

function setCharacter(character) {
  characters.forEach((el) => el.classList.toggle('active', el.id === `char-${character}`));
  document.querySelectorAll('#character-row .chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.character === character));
  });
}

document.getElementById('character-row').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (chip) setCharacter(chip.dataset.character);
});

document.getElementById('state-row').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (chip) setState(chip.dataset.state);
});

stage.addEventListener('click', () => setState('poke'));

setState('idle');
setCharacter('blob');
