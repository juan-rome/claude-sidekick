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

/**
 * `tell application "X" to activate` alone doesn't reliably restore a
 * minimized window on macOS: it can make the app frontmost while its
 * window stays sitting in the Dock. Un-minimizing needs the
 * accessibility API specifically, so this walks the process's windows
 * via System Events and clears AXMinimized on any that are set, then
 * sets the process frontmost.
 */
function activateApp(name) {
  return new Promise((resolve) => {
    if (!name) {
      resolve(false);
      return;
    }
    const escaped = name.replace(/"/g, '\\"');
    const script = `
      tell application "System Events"
        tell process "${escaped}"
          repeat with w in windows
            if value of attribute "AXMinimized" of w is true then
              set value of attribute "AXMinimized" of w to false
            end if
          end repeat
          set frontmost to true
        end tell
      end tell
    `;
    execFile('osascript', ['-e', script], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Remembers whichever app was frontmost before Sidekick's own window
 * takes focus, so a double-click can bring it back. Claude Code doesn't
 * have one single "window" (Terminal, iTerm, VS Code, the Claude
 * desktop app...), so rather than guess which one you use, this just
 * tracks whatever was actually in front, the same thing Cmd+Tab would
 * take you back to.
 *
 * Captured fresh on demand (call `capture()` right when a click gesture
 * starts) rather than via a background poll: a periodic poll only knows
 * what was frontmost as of its last tick, which can be stale by however
 * long the interval is, or worse if that app was ever true again. A
 * capture at the moment of interaction reflects what you were actually
 * just looking at.
 *
 * Uses AppleScript (System Events), since Electron has no direct
 * visibility into which *other* application is frontmost. Triggers the
 * one-time "Sidekick wants to control this computer using System
 * Events" Automation permission prompt on macOS the first time it runs.
 */
function createFrontmostAppTracker({ appGetName } = {}) {
  const excluded = ownAppNames(appGetName);
  let lastOtherApp = null;

  return {
    capture: async () => {
      const name = await getFrontmostAppName();
      if (name && !excluded.has(name)) {
        lastOtherApp = name;
      }
    },
    getLastOtherApp: () => lastOtherApp,
  };
}

module.exports = { getFrontmostAppName, activateApp, createFrontmostAppTracker };
