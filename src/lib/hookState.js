/**
 * Maps a raw Claude Code hook payload (the JSON a hook sends on stdin, or
 * posts over HTTP) to one of Sidekick's animation states. Kept separate
 * from the HTTP server / Electron wiring so the mapping itself is a plain,
 * synchronous function that's easy to unit test.
 */

// 'poke' (clicked) is triggered locally in the renderer rather than
// from a hook event, so it's not in this list, but it's a valid
// animation state the renderer also responds to.
const STATES = ['idle', 'greet', 'working', 'success', 'error', 'goodbye'];

/** How long a reactive state (anything but idle/working) holds before
 *  Sidekick settles back to idle on its own, in milliseconds. */
const REACTION_HOLD_MS = 2500;

function stateForHookEvent(payload) {
  const event = payload && payload.hook_event_name;

  switch (event) {
    case 'SessionStart':
      return 'greet';
    case 'PreToolUse':
      return 'working';
    case 'PostToolUse':
      return 'success';
    case 'PostToolUseFailure':
      return 'error';
    case 'SessionEnd':
      return 'goodbye';
    case 'Stop':
      return 'idle';
    default:
      return null;
  }
}

module.exports = { STATES, REACTION_HOLD_MS, stateForHookEvent };
