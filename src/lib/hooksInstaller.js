const fs = require('fs');
const os = require('os');
const path = require('path');
const { DEFAULT_PORT } = require('./hookServer');

const HOOK_URL = `http://127.0.0.1:${DEFAULT_PORT}/hook`;

/** Which events need a matcher, per Claude Code's hooks schema (README's
 *  setup table): tool-scoped events are matched against every tool ("*"),
 *  session-scoped ones aren't matched against anything. */
const HOOK_EVENTS = [
  { name: 'SessionStart', matcher: null },
  { name: 'PreToolUse', matcher: '*' },
  { name: 'PostToolUse', matcher: '*' },
  { name: 'PostToolUseFailure', matcher: '*' },
  { name: 'Stop', matcher: null },
  { name: 'SessionEnd', matcher: null },
  { name: 'Notification', matcher: null },
];

function settingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function readSettings(filePath = settingsPath()) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function groupHasOurHook(group) {
  return Array.isArray(group.hooks) && group.hooks.some((hook) => hook.url === HOOK_URL);
}

/** True only once every event Sidekick needs already forwards to it,
 *  so a partial or stale hooks config doesn't count as installed. */
function areHooksInstalled(settings = readSettings()) {
  const hooks = settings.hooks || {};
  return HOOK_EVENTS.every(({ name }) => {
    const groups = hooks[name];
    return Array.isArray(groups) && groups.some(groupHasOurHook);
  });
}

/**
 * Merges Sidekick's hook into settings.json without touching anything
 * else the user has configured: each event gets one new hook group of
 * its own (rather than editing an existing group in place), and only
 * for events that don't already have our URL somewhere in them. A .bak
 * copy is written first since this edits a real, shared config file
 * that the user didn't ask us to touch until now. `filePath` is
 * injectable so tests can point this at a throwaway file instead of
 * the real ~/.claude/settings.json.
 */
function installHooks(filePath = settingsPath()) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const settings = readSettings(filePath);
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }

  settings.hooks = settings.hooks || {};
  let changed = false;

  for (const { name, matcher } of HOOK_EVENTS) {
    const groups = Array.isArray(settings.hooks[name]) ? settings.hooks[name] : [];
    if (groups.some(groupHasOurHook)) {
      settings.hooks[name] = groups;
      continue;
    }
    const hookDef = { type: 'http', url: HOOK_URL, timeout: 2 };
    const group = matcher ? { matcher, hooks: [hookDef] } : { hooks: [hookDef] };
    settings.hooks[name] = [...groups, group];
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
  }
  return changed;
}

/**
 * The reverse of installHooks: removes exactly the groups install added
 * (a group counts as "ours" only if every hook in it points at our URL,
 * matching how installHooks always creates a group containing nothing
 * else), leaving everything the user configured separately untouched.
 * Also writes a .bak copy first, same as install.
 */
function uninstallHooks(filePath = settingsPath()) {
  if (!fs.existsSync(filePath)) return false;

  const settings = readSettings(filePath);
  fs.copyFileSync(filePath, `${filePath}.bak`);

  const hooks = settings.hooks || {};
  let changed = false;

  for (const { name } of HOOK_EVENTS) {
    const groups = Array.isArray(hooks[name]) ? hooks[name] : [];
    const remaining = groups.filter((group) => !groupHasOurHook(group));
    if (remaining.length !== groups.length) {
      changed = true;
      if (remaining.length > 0) {
        hooks[name] = remaining;
      } else {
        delete hooks[name];
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
  }
  return changed;
}

module.exports = { HOOK_URL, areHooksInstalled, installHooks, uninstallHooks, settingsPath };
