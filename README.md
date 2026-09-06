# Claude Sidekick

A small floating desktop companion that reacts in real time to your Claude
Code sessions: it perks up when a tool call starts, celebrates when one
succeeds, looks worried when one fails, and greets/waves goodbye at the
start and end of a session. No pixel art, a soft, rounded, animated
character that lives wherever you drag it on screen.

Four characters ship today: a blob, a ghost, a bunny, and a jellyfish.
Pick one from the tray icon's Character submenu.

The first three are SVG/CSS. The jellyfish is different: it's rendered
entirely with Three.js's `WebGPURenderer` rather than SVG, a translucent
glowing bell (built procedurally from half a sphere, no 3D modeling
software involved) that pulses like it's swimming, with tentacles that
sway via a wave curve recomputed every frame.

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

All of that runs on the same shared WebGPU accent layer (Three.js's
`WebGPURenderer` on a transparent canvas over whichever SVG character is
active, WebGL2 fallback automatic where WebGPU isn't available):

- **Success**: a confetti burst.
- **Poke**: a soft gray "poof" puff.
- **Error**: a couple of worried blue drops falling.
- **Working**: a light sparkle trail orbiting the character.
- **Idle/working**: a handful of faint ambient motes drifting nearby,
  fading out for busier states so they don't compete with a burst.

A full 3D redesign of the ghost and bunny (procedural Three.js primitives
instead of SVG) was prototyped and set aside: it looked like a 3D
character, just not *that* character, since it dropped the exact palette
and proportions the SVG versions had already been tuned to. Layering
accents on top of the existing art, as above, kept what already worked.

## Setup

### 1. Install and run Sidekick

```bash
npm install
npm start
```

A small character appears in the bottom-right corner of your screen (drag
it anywhere you like), and a menu bar icon lets you show/hide it, switch
characters, or quit.

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

- More characters.
- More WebGPU effects (a glow/aura, a particle trail while working) —
  the full 3D-model route (replacing the SVG art with rigged 3D
  characters) was scoped and set aside as its own separate undertaking,
  comparable in size to the Live2D path below; what shipped instead is
  lightweight effects layered on top of the existing 2D art.
- Live2D-quality rigged animation was scoped and deliberately set aside
  for now (it needs pre-layered source art plus a real rigging pass in
  Cubism Editor, a much bigger lift than this project's scope); the
  current approach hand-builds detailed SVG art and animates it with CSS,
  aiming for a similar visual richness without the separate rigging tool.
