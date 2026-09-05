# Claude Sidekick

A small floating desktop companion that reacts in real time to your Claude
Code sessions: it perks up when a tool call starts, celebrates when one
succeeds, looks worried when one fails, and greets/waves goodbye at the
start and end of a session. No pixel art, a soft, rounded, animated
character that lives wherever you drag it on screen.

This is an early scaffold: the pipeline (tray icon, floating window, and
the live hook connection) is fully working end to end, with one character
(the blob) built out to validate the approach before drawing the rest of
the roster (cat, small dragon).

## How it works

Claude Code can run arbitrary shell commands or HTTP requests in response
to session events ("hooks"). Sidekick runs a tiny local HTTP server and
maps incoming hook events to an animation state:

| Hook event          | Sidekick state |
| -------------------- | -------------- |
| `SessionStart`        | greet          |
| `PreToolUse`          | working        |
| `PostToolUse`         | success        |
| `PostToolUseFailure`  | error          |
| `Stop`                | idle           |
| `SessionEnd`          | goodbye        |

Reactive states (everything but idle/working) automatically settle back
to idle a couple of seconds after firing, so the character never gets
stuck mid-reaction.

## Setup

### 1. Install and run Sidekick

```bash
npm install
npm start
```

A small blob appears in the bottom-right corner of your screen (drag it
anywhere you like), and a menu bar icon lets you show/hide it or quit.

### 2. Point Claude Code's hooks at it

Add this to your `~/.claude/settings.json` (or a project's
`.claude/settings.json`) to forward the relevant events:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }] }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "*",
        "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }]
      }
    ],
    "Stop": [
      { "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }] }
    ]
  }
}
```

Claude Code POSTs its normal hook JSON straight to Sidekick, no extra
scripting needed.

### 3. Run the tests

```bash
npm test
```

## What's next

- Draw out the cat and small-dragon characters and wire up a character
  switcher (the state machine and window/tray plumbing already support
  swapping the rendered character, only the art is missing).
- Replace the CSS-animated blob with proper vector/Lottie-style animation
  for smoother motion.
