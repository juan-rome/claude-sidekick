const stage = document.getElementById('stage');

function setState(state) {
  stage.className = `state-${state}`;
}

window.sidekick.onState(setState);
