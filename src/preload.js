const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sidekick', {
  onState: (callback) => {
    ipcRenderer.on('sidekick:state', (_event, state) => callback(state));
  },
});
