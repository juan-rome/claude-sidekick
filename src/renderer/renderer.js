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

stage.addEventListener('click', handlePoke);

window.sidekick.onState(setState);
window.sidekick.onCharacter(setCharacter);
