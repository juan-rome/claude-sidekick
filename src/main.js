const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./lib/store');
const { startHookServer, DEFAULT_PORT } = require('./lib/hookServer');
const { REACTION_HOLD_MS } = require('./lib/hookState');
const { areHooksInstalled, installHooks, uninstallHooks, settingsPath } = require('./lib/hooksInstaller');
const { activateApp, createFrontmostAppTracker } = require('./lib/frontmostApp');

let tray;
let sidekickWindow;
let galleryWindow;
let hookServer;
let dragOrigin = null;
let hooksReady = false;
let frontmostAppTracker = null;

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

// Both default to on: store.get returns undefined for a key that's
// never been set, and undefined !== false is true.
function getShowBubbles() {
  return store.get('showBubbles') !== false;
}

function getAlwaysOnTop() {
  return store.get('alwaysOnTop') !== false;
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
    alwaysOnTop: getAlwaysOnTop(),
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  sidekickWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  sidekickWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  sidekickWindow.webContents.on('did-finish-load', () => {
    sidekickWindow.webContents.send('sidekick:character', getCharacter());
    sidekickWindow.webContents.send('sidekick:showBubbles', getShowBubbles());
    setTimeout(wave, 600);
  });
}

/**
 * A normal, titled window (unlike the frameless always-on-top sidekick
 * one) showing every character and state side by side, for picking a
 * character or just seeing what a state looks like without waiting for
 * Claude Code to trigger it. Reuses the exact same character modules as
 * the real widget rather than a separate copy, so it can't drift out of
 * sync with what actually ships.
 */
function openGalleryWindow() {
  if (galleryWindow && !galleryWindow.isDestroyed()) {
    galleryWindow.show();
    galleryWindow.focus();
    return;
  }

  galleryWindow = new BrowserWindow({
    width: 480,
    height: 660,
    title: 'Sidekick Character Viewer',
  });
  galleryWindow.loadFile(path.join(__dirname, 'renderer', 'gallery.html'));
  galleryWindow.on('closed', () => {
    galleryWindow = null;
  });
}

/**
 * Launch at Login always applies, hooks installed or not. The rest only
 * mean anything once there's a real sidekick window to affect, so they
 * only show up once hooksReady.
 */
function buildSettingsSubmenu() {
  const items = [
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: toggleLaunchAtLogin,
    },
  ];

  if (hooksReady) {
    items.push(
      {
        label: 'Speech Bubbles',
        type: 'checkbox',
        checked: getShowBubbles(),
        click: toggleShowBubbles,
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: getAlwaysOnTop(),
        click: toggleAlwaysOnTop,
      },
      { type: 'separator' },
      { label: 'Reset Window Position', click: resetWindowPosition },
      { type: 'separator' },
      { label: 'Uninstall Hooks...', click: runUninstallHooks },
      { type: 'separator' },
      {
        label: 'Note: one Claude Code session at a time',
        enabled: false,
        toolTip:
          'Sidekick has a single hook server and a single character state. ' +
          'Running two Claude Code sessions at once means both drive the ' +
          'same character, so events from one can interrupt the other.',
      }
    );
  }

  return items;
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
        { label: 'Character Viewer...', click: openGalleryWindow },
        { label: 'Settings', submenu: buildSettingsSubmenu() },
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
      { label: 'Character Viewer...', click: openGalleryWindow },
      { label: 'Settings', submenu: buildSettingsSubmenu() },
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

function toggleLaunchAtLogin() {
  const current = app.getLoginItemSettings().openAtLogin;
  app.setLoginItemSettings({ openAtLogin: !current });
  createTray();
}

function toggleShowBubbles() {
  const next = !getShowBubbles();
  store.set('showBubbles', next);
  if (sidekickWindow && !sidekickWindow.isDestroyed()) {
    sidekickWindow.webContents.send('sidekick:showBubbles', next);
  }
  createTray();
}

function toggleAlwaysOnTop() {
  const next = !getAlwaysOnTop();
  store.set('alwaysOnTop', next);
  if (sidekickWindow && !sidekickWindow.isDestroyed()) {
    sidekickWindow.setAlwaysOnTop(next);
  }
  createTray();
}

function resetWindowPosition() {
  if (!sidekickWindow || sidekickWindow.isDestroyed()) return;
  const { x, y } = defaultPosition();
  sidekickWindow.setPosition(x, y);
  store.set('windowPosition', { x, y });
}

/**
 * Double-clicking the character brings back whatever you were using
 * before you clicked it, rather than any specific app: Claude Code runs
 * inside Terminal, iTerm, VS Code, the Claude desktop app, or others,
 * and there's no one "the Claude window" to target directly.
 */
function bringPreviousAppForward() {
  if (!frontmostAppTracker) return;
  activateApp(frontmostAppTracker.getLastOtherApp());
}

/**
 * The reverse of "Install Hooks to Get Started": confirmed first, since
 * unlike installing, this removes something the user asked for rather
 * than adding it. Re-gates the window afterward, symmetric with how it
 * stays hidden until hooks are installed in the first place.
 */
function runUninstallHooks() {
  dialog
    .showMessageBox({
      type: 'question',
      title: 'Claude Sidekick',
      message: 'Uninstall Sidekick\'s hooks?',
      detail: `This removes Sidekick's entries from ${settingsPath()} (a .bak copy is written first) and hides the character until they're installed again. Anything else you've configured there is left untouched.`,
      buttons: ['Cancel', 'Uninstall'],
      defaultId: 0,
      cancelId: 0,
    })
    .then(({ response }) => {
      if (response !== 1) return;
      uninstallHooks();
      hooksReady = false;
      if (sidekickWindow && !sidekickWindow.isDestroyed()) {
        sidekickWindow.close();
      }
      createTray();
    });
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
      `${err.message}\n\nYou can add them yourself in ${settingsPath()} instead, see the README.`
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
  // Captured here, at the very start of the click/drag gesture, rather
  // than from a background poll: this is the freshest possible read of
  // "what was frontmost right before you touched Sidekick."
  if (frontmostAppTracker) frontmostAppTracker.capture();
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

ipcMain.on('sidekick:bring-forward', bringPreviousAppForward);

app.whenReady().then(() => {
  hooksReady = areHooksInstalled();
  if (hooksReady) {
    createSidekickWindow();
  }
  createTray();

  frontmostAppTracker = createFrontmostAppTracker({ appGetName: app.getName() });

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
