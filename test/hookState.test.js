const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stateForHookEvent } = require('../src/lib/hookState');

test('maps known hook events to their animation state', () => {
  assert.equal(stateForHookEvent({ hook_event_name: 'SessionStart' }), 'greet');
  assert.equal(stateForHookEvent({ hook_event_name: 'PreToolUse' }), 'working');
  assert.equal(stateForHookEvent({ hook_event_name: 'PostToolUse' }), 'success');
  assert.equal(stateForHookEvent({ hook_event_name: 'PostToolUseFailure' }), 'error');
  assert.equal(stateForHookEvent({ hook_event_name: 'SessionEnd' }), 'goodbye');
  assert.equal(stateForHookEvent({ hook_event_name: 'Stop' }), 'idle');
});

test('returns null for unrecognized or missing events', () => {
  assert.equal(stateForHookEvent({ hook_event_name: 'PreCompact' }), null);
  assert.equal(stateForHookEvent({}), null);
  assert.equal(stateForHookEvent(null), null);
});
