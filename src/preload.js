const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sidekick', {
  onState: (callback) => {
    ipcRenderer.on('sidekick:state', (_event, state) => callback(state));
  },
  onCharacter: (callback) => {
    ipcRenderer.on('sidekick:character', (_event, character) => callback(character));
  },
  onShowBubbles: (callback) => {
    ipcRenderer.on('sidekick:showBubbles', (_event, show) => callback(show));
  },
  dragStart: () => ipcRenderer.send('sidekick:drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('sidekick:drag-move', dx, dy),
  dragEnd: () => ipcRenderer.send('sidekick:drag-end'),
});
