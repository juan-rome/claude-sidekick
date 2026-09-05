const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./lib/store');
const { startHookServer, DEFAULT_PORT } = require('./lib/hookServer');
const { REACTION_HOLD_MS } = require('./lib/hookState');

let tray;
let sidekickWindow;
let hookServer;
let moveSaveTimer = null;

const WINDOW_SIZE = 160;
const CHARACTERS = [
  { id: 'blob', label: 'Blob' },
  { id: 'ghost', label: 'Ghost' },
  { id: 'bunny', label: 'Bunny' },
];

function getCharacter() {
  return store.get('character') || 'blob';
}

function setCharacter(character) {
  store.set('character', character);
  if (sidekickWindow && !sidekickWindow.isDestroyed()) {
    sidekickWindow.webContents.send('sidekick:character', character);
  }
  createTray();
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WINDOW_SIZE - 24,
    y: workArea.y + workArea.height - WINDOW_SIZE - 24,
  };
}

function createSidekickWindow() {
  const saved = store.get('windowPosition');
  const position = saved || defaultPosition();

  sidekickWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  sidekickWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  sidekickWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  sidekickWindow.webContents.on('did-finish-load', () => {
    sidekickWindow.webContents.send('sidekick:character', getCharacter());
    // A little hello once the character's actually on screen, independent
    // of any real Claude Code session starting. Sent directly rather than
    // through the hook server, so it settles itself back to idle here too.
    setTimeout(() => {
      if (sidekickWindow && !sidekickWindow.isDestroyed()) {
        sidekickWindow.webContents.send('sidekick:state', 'greet');
        setTimeout(() => {
          if (sidekickWindow && !sidekickWindow.isDestroyed()) {
            sidekickWindow.webContents.send('sidekick:state', 'idle');
          }
        }, REACTION_HOLD_MS);
      }
    }, 400);
  });

  sidekickWindow.on('moved', () => {
    if (moveSaveTimer) clearTimeout(moveSaveTimer);
    moveSaveTimer = setTimeout(() => {
      const [x, y] = sidekickWindow.getPosition();
      store.set('windowPosition', { x, y });
    }, 300);
  });
}

function createTray() {
  if (!tray) {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
    icon.addRepresentation({
      scaleFactor: 2,
      buffer: fs.readFileSync(path.join(__dirname, 'assets', 'tray-icon@2x.png')),
    });
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setToolTip('Claude Sidekick');
  }

  const currentCharacter = getCharacter();

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: sidekickWindow.isVisible() ? 'Hide Sidekick' : 'Show Sidekick',
        click: toggleVisibility,
      },
      { type: 'separator' },
      {
        label: 'Character',
        submenu: CHARACTERS.map(({ id, label }) => ({
          label,
          type: 'radio',
          checked: currentCharacter === id,
          click: () => setCharacter(id),
        })),
      },
      { type: 'separator' },
      { label: 'Quit Claude Sidekick', click: () => app.quit() },
    ])
  );
}

function toggleVisibility() {
  if (sidekickWindow.isVisible()) {
    sidekickWindow.hide();
  } else {
    sidekickWindow.show();
  }
}

app.whenReady().then(() => {
  createSidekickWindow();
  createTray();

  hookServer = startHookServer({
    port: DEFAULT_PORT,
    onState: (state) => {
      if (sidekickWindow && !sidekickWindow.isDestroyed()) {
        sidekickWindow.webContents.send('sidekick:state', state);
      }
    },
  });
});

app.on('window-all-closed', (event) => {
  // Sidekick lives in the menu bar; closing its window shouldn't quit it.
  event.preventDefault();
});

app.on('before-quit', () => {
  if (hookServer) hookServer.close();
});
