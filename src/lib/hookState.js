/**
 * Maps a raw Claude Code hook payload (the JSON a hook sends on stdin, or
 * posts over HTTP) to one of Sidekick's animation states. Kept separate
 * from the HTTP server / Electron wiring so the mapping itself is a plain,
 * synchronous function that's easy to unit test.
 */

// 'poke' (clicked) is triggered locally in the renderer rather than
// from a hook event, so it's not in this list, but it's a valid
// animation state the renderer also responds to.
const STATES = ['idle', 'greet', 'working', 'success', 'error', 'question', 'goodbye'];

/** How long a reactive state holds before Sidekick settles back to idle
 *  on its own, in milliseconds. Doesn't apply to idle/working (nothing
 *  to settle from) or question (see stateForHookEvent below). */
const REACTION_HOLD_MS = 2500;

/** Which Notification subtypes actually mean "waiting on you" rather
 *  than informational chatter (auth succeeded, a quota timer resumed,
 *  a subagent wrapped up) that shouldn't interrupt whatever the
 *  character is already doing. */
const WAITING_NOTIFICATION_TYPES = new Set([
  'permission_prompt',
  'idle_prompt',
  'elicitation_dialog',
  'elicitation_url_dialog',
  'agent_needs_input',
]);

function stateForHookEvent(payload) {
  const event = payload && payload.hook_event_name;

  switch (event) {
    case 'SessionStart':
      return 'greet';
    case 'PreToolUse':
    case 'PostToolUse':
      // PostToolUse fires after *every* successful tool call, dozens of
      // times a turn, so it isn't the "task is done" moment even though
      // the name suggests it. Stop (below) is the real one.
      return 'working';
    case 'PostToolUseFailure':
      return 'error';
    case 'Stop':
      return 'success';
    case 'SessionEnd':
      return 'goodbye';
    case 'Notification':
      // question doesn't auto-revert like the other reactive states
      // (see hookServer.js): "waiting on you" can last far longer than
      // a couple of seconds, so it holds until the next real event.
      return WAITING_NOTIFICATION_TYPES.has(payload.notification_type) ? 'question' : null;
    default:
      return null;
  }
}

module.exports = { STATES, REACTION_HOLD_MS, stateForHookEvent };
