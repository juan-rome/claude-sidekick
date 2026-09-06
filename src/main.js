const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./lib/store');
const { startHookServer, DEFAULT_PORT } = require('./lib/hookServer');
const { REACTION_HOLD_MS } = require('./lib/hookState');
const { areHooksInstalled, installHooks, settingsPath } = require('./lib/hooksInstaller');

let tray;
let sidekickWindow;
let hookServer;
let dragOrigin = null;
let hooksReady = false;

const WINDOW_SIZE = 160;
const CHARACTERS = [
  { id: 'blob', label: 'Blob' },
  { id: 'ghost', label: 'Ghost' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'jellyfish', label: 'Jellyfish' },
  { id: 'gadget', label: 'Gadget' },
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
  wave();
}

/** A little hello, independent of any real Claude Code session: on first
 *  launch, and again whenever you switch characters so the new one gets
 *  its own greeting. Sent directly rather than through the hook server,
 *  since that path already owns hook-driven reverts. */
function wave() {
  if (!sidekickWindow || sidekickWindow.isDestroyed()) return;
  sidekickWindow.webContents.send('sidekick:state', 'greet');
  setTimeout(() => {
    if (sidekickWindow && !sidekickWindow.isDestroyed()) {
      sidekickWindow.webContents.send('sidekick:state', 'idle');
    }
  }, REACTION_HOLD_MS);
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
    setTimeout(wave, 600);
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

  if (!hooksReady) {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Install Hooks to Get Started', click: runInstallHooks },
        { type: 'separator' },
        { label: 'Quit Claude Sidekick', click: () => app.quit() },
      ])
    );
    return;
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

/**
 * Sidekick shouldn't be visible on screen at all until Claude Code is
 * actually wired up to talk to it, since an unhooked window would just
 * sit there doing nothing and looking broken. This is the one thing
 * that turns it on: merge the hook config into ~/.claude/settings.json,
 * then create and show the window for the first time.
 */
function runInstallHooks() {
  try {
    installHooks();
    hooksReady = true;
    if (!sidekickWindow || sidekickWindow.isDestroyed()) {
      createSidekickWindow();
    }
    createTray();
    dialog.showMessageBox({
      type: 'info',
      title: 'Claude Sidekick',
      message: 'Hooks installed!',
      detail:
        'Claude Code reads its settings at the start of a session, so restart any session that\'s already running for it to pick up Sidekick.',
      buttons: ['OK'],
    });
  } catch (err) {
    dialog.showErrorBox(
      'Could not install hooks',
      `${err.message}\n\nYou can add them yourself in ${settingsPath()} instead — see the README.`
    );
  }
}

// Dragging is handled manually (rather than -webkit-app-region: drag) so
// the renderer can tell a real drag apart from a click-to-poke: a drag
// region swallows click events entirely, which is why clicking the
// character to poke it never fired anything.
ipcMain.on('sidekick:drag-start', () => {
  if (sidekickWindow && !sidekickWindow.isDestroyed()) {
    dragOrigin = sidekickWindow.getPosition();
  }
});

ipcMain.on('sidekick:drag-move', (_event, dx, dy) => {
  if (!dragOrigin || !sidekickWindow || sidekickWindow.isDestroyed()) return;
  sidekickWindow.setPosition(Math.round(dragOrigin[0] + dx), Math.round(dragOrigin[1] + dy));
});

ipcMain.on('sidekick:drag-end', () => {
  dragOrigin = null;
  if (sidekickWindow && !sidekickWindow.isDestroyed()) {
    const [x, y] = sidekickWindow.getPosition();
    store.set('windowPosition', { x, y });
  }
});

app.whenReady().then(() => {
  hooksReady = areHooksInstalled();
  if (hooksReady) {
    createSidekickWindow();
  }
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
