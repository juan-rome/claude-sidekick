const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stateForHookEvent } = require('../src/lib/hookState');

test('maps known hook events to their animation state', () => {
  assert.equal(stateForHookEvent({ hook_event_name: 'SessionStart' }), 'greet');
  assert.equal(stateForHookEvent({ hook_event_name: 'PreToolUse' }), 'working');
  // PostToolUse fires per successful tool call, not per finished task, so
  // it folds into 'working' rather than triggering its own celebration.
  assert.equal(stateForHookEvent({ hook_event_name: 'PostToolUse' }), 'working');
  assert.equal(stateForHookEvent({ hook_event_name: 'PostToolUseFailure' }), 'error');
  assert.equal(stateForHookEvent({ hook_event_name: 'SessionEnd' }), 'goodbye');
  // Stop is the real "finished responding to what you asked" moment.
  assert.equal(stateForHookEvent({ hook_event_name: 'Stop' }), 'success');
});

test('Notification only becomes "question" for subtypes that mean waiting on you', () => {
  assert.equal(
    stateForHookEvent({ hook_event_name: 'Notification', notification_type: 'permission_prompt' }),
    'question'
  );
  assert.equal(
    stateForHookEvent({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }),
    'question'
  );
  assert.equal(
    stateForHookEvent({ hook_event_name: 'Notification', notification_type: 'agent_needs_input' }),
    'question'
  );
  assert.equal(
    stateForHookEvent({ hook_event_name: 'Notification', notification_type: 'auth_success' }),
    null
  );
  assert.equal(stateForHookEvent({ hook_event_name: 'Notification' }), null);
});

test('returns null for unrecognized or missing events', () => {
  assert.equal(stateForHookEvent({ hook_event_name: 'PreCompact' }), null);
  assert.equal(stateForHookEvent({}), null);
  assert.equal(stateForHookEvent(null), null);
});
