const stage = document.getElementById('stage');
const characters = document.querySelectorAll('.character');

function setState(state) {
  stage.className = `state-${state}`;
}

function setCharacter(character) {
  characters.forEach((el) => {
    el.classList.toggle('active', el.id === `char-${character}`);
  });
}

window.sidekick.onState(setState);
window.sidekick.onCharacter(setCharacter);
