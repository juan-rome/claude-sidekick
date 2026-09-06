const { execFile } = require('child_process');

/** Names our own running process can show up as: "Electron" while
 *  running unpackaged (`npm start`), the packaged productName once
 *  built, whatever Electron's app.getName() resolves to in between. */
function ownAppNames(appGetName) {
  return new Set(['Electron', 'Claude Sidekick', appGetName]);
}

function getFrontmostAppName() {
  return new Promise((resolve) => {
    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to get name of first application process whose frontmost is true'],
      (err, stdout) => {
        resolve(err ? null : stdout.trim());
      }
    );
  });
}

function activateApp(name) {
  return new Promise((resolve) => {
    if (!name) {
      resolve(false);
      return;
    }
    const escaped = name.replace(/"/g, '\\"');
    execFile('osascript', ['-e', `tell application "${escaped}" to activate`], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Remembers whichever app was frontmost before Sidekick's own window
 * most recently took focus, so a double-click can bring it back.
 * Claude Code doesn't have one single "window" (Terminal, iTerm,
 * VS Code, the Claude desktop app...), so rather than guess which one
 * you use, this just tracks whatever was actually in front, the same
 * thing Cmd+Tab would take you back to.
 *
 * Implemented as light polling via AppleScript (System Events), since
 * Electron has no direct visibility into which *other* application is
 * frontmost. Triggers the one-time "Sidekick wants to control this
 * computer using System Events" Automation permission prompt on macOS.
 */
function startTrackingFrontmostApp({ appGetName, intervalMs = 3000 } = {}) {
  const excluded = ownAppNames(appGetName);
  let lastOtherApp = null;

  const timer = setInterval(async () => {
    const name = await getFrontmostAppName();
    if (name && !excluded.has(name)) {
      lastOtherApp = name;
    }
  }, intervalMs);

  return {
    getLastOtherApp: () => lastOtherApp,
    stop: () => clearInterval(timer),
  };
}

module.exports = { getFrontmostAppName, activateApp, startTrackingFrontmostApp };
