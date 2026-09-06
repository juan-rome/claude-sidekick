const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HOOK_URL, areHooksInstalled, installHooks } = require('../src/lib/hooksInstaller');

function tempSettingsPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sidekick-test-')), 'settings.json');
}

test('areHooksInstalled is false until every required event has our hook', () => {
  assert.equal(areHooksInstalled({}), false);
  assert.equal(
    areHooksInstalled({
      hooks: { SessionStart: [{ hooks: [{ type: 'http', url: HOOK_URL }] }] },
    }),
    false
  );
});

test('installHooks writes a config areHooksInstalled then accepts', () => {
  const filePath = tempSettingsPath();
  const changed = installHooks(filePath);
  assert.equal(changed, true);

  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(areHooksInstalled(written), true);
});

test('installHooks preserves existing unrelated settings and hook groups', () => {
  const filePath = tempSettingsPath();
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      someOtherSetting: true,
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }],
      },
    })
  );

  installHooks(filePath);
  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  assert.equal(written.someOtherSetting, true);
  assert.equal(written.hooks.PreToolUse.length, 2);
  assert.equal(written.hooks.PreToolUse[0].matcher, 'Bash');
  assert.ok(fs.existsSync(`${filePath}.bak`));
});

test('installHooks is a no-op the second time it runs', () => {
  const filePath = tempSettingsPath();
  installHooks(filePath);
  const changedAgain = installHooks(filePath);
  assert.equal(changedAgain, false);
});
