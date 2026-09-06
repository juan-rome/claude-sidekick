# Claude Sidekick

A small floating desktop companion that reacts in real time to your Claude
Code sessions: it perks up when a tool call starts, celebrates when one
succeeds, looks worried when one fails, and greets/waves goodbye at the
start and end of a session. No pixel art, a soft, rounded, animated
character that lives wherever you drag it on screen.

Five characters ship today: a blob, a ghost, a bunny, a jellyfish, and a
gadget. Pick one from the tray icon's Character submenu, or open
**Character Viewer...** from the same menu for a normal window that
shows every character and every state side by side, manually triggered
instead of waiting for Claude Code to fire the real hook events. It
imports the exact same character modules as the widget itself, so it
can't drift out of sync with what actually ships.

The first three are SVG/CSS. The jellyfish and gadget are different:
they're rendered entirely with Three.js's `WebGPURenderer` rather than
SVG. The jellyfish is a translucent glowing bell (built procedurally from
half a sphere, no 3D modeling software involved) that pulses like it's
swimming, with tentacles that sway via a wave curve recomputed every
frame. The gadget is a frosted-glass handheld console (rounded box, D-pad,
button, all procedural) with a screen that shows a small canvas-drawn
face, redrawn per state the way a real device would render a sprite; its
gaze drifts toward the cursor while idle, the trait it was modeled after.

## How it works

Claude Code can run arbitrary shell commands or HTTP requests in response
to session events ("hooks"). Sidekick runs a tiny local HTTP server and
maps incoming hook events to an animation state:

| Hook event                       | Sidekick state |
| --------------------------------- | -------------- |
| `SessionStart`                     | greet          |
| `PreToolUse` / `PostToolUse`       | working        |
| `PostToolUseFailure`               | error          |
| `Notification` (waiting on you)    | question       |
| `Stop`                             | success        |
| `SessionEnd`                       | goodbye        |

`PostToolUse` fires after *every* successful tool call, dozens of times
a turn, so it folds into `working` rather than triggering its own
celebration each time. `Stop`, which fires once when Claude actually
finishes responding, is the real "done" moment. `Notification` covers
permission prompts, idle timeouts, and MCP dialogs; Sidekick only reacts
to the subtypes that actually mean "waiting on you" (not things like
`auth_success`).

Reactive states (everything but idle/working) automatically settle back
to idle a couple of seconds after firing, so the character never gets
stuck mid-reaction, except question, which holds until a real event
replaces it, since "waiting on you" can last a lot longer than a
couple of seconds.

All of that runs on the same shared WebGPU accent layer (Three.js's
`WebGPURenderer` on a transparent canvas over whichever SVG character is
active, WebGL2 fallback automatic where WebGPU isn't available):

- **Success**: a confetti burst.
- **Poke**: a soft gray "poof" puff.
- **Error**: a couple of worried blue drops falling.
- **Working**: a light sparkle trail orbiting the character.
- **Idle/working/question**: a handful of faint ambient motes drifting
  nearby, fading out for busier states so they don't compete with a burst.

Every reactive state but working and success also pops a short speech
bubble above the character: "Hi!", "Oops!", "What do you think?", "Bye!",
"Hehe!" on poke. Success skips it too, since the confetti and happy
face already say it.

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

Sidekick stays invisible until it's actually wired up to Claude Code,
since an unhooked character would just sit there doing nothing. A menu bar
icon appears with one item: **Install Hooks to Get Started**. Click it
and Sidekick merges its hook config into `~/.claude/settings.json` for
you (a `.bak` copy of the file is written first) and shows the character
for the first time, in the bottom-right corner of your screen (drag it
anywhere you like). Restart any Claude Code session that was already
running so it picks up the new hooks.

Once installed, the menu bar icon switches to the full menu: show/hide
the character, switch characters, open the Character Viewer, or adjust
Settings:

- **Launch at Login**: starts Sidekick automatically when you log into
  your Mac (this is about your Mac's login, not any Claude account;
  Sidekick doesn't authenticate with anything, see "How it works" above).
- **Speech Bubbles**: turn the "Hi!"/"Bye!"/etc. reaction lines off if
  you'd rather the character react silently.
- **Always on Top**: turn off if you don't want it floating above every
  other window.
- **Reset Window Position**: snaps it back to the bottom-right corner,
  useful if it's been dragged off-screen or a display got unplugged.
- **Uninstall Hooks...**: the reverse of installing. Removes Sidekick's
  entries from `~/.claude/settings.json` (a `.bak` copy is written
  first) and hides the character again, without touching anything else
  you've configured there.

If you installed Sidekick before the `Notification` hook (the "waiting
on you" question state) was added, click **Install Hooks to Get
Started** again; it's a no-op for events you already have and just
adds the one that's missing.

### Setting hooks up by hand

If you'd rather not have Sidekick edit your settings file, add this to
`~/.claude/settings.json` (or a project's `.claude/settings.json`)
yourself to forward the relevant events:

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
    ],
    "Notification": [
      { "hooks": [{ "type": "http", "url": "http://127.0.0.1:8934/hook", "timeout": 2 }] }
    ]
  }
}
```

Claude Code POSTs its normal hook JSON straight to Sidekick, no extra
scripting needed.

### 2. Run the tests

```bash
npm test
```

## What's next

- More characters.
- More WebGPU effects (a glow/aura, a particle trail while working):
  the full 3D-model route (replacing the SVG art with rigged 3D
  characters) was scoped and set aside as its own separate undertaking,
  comparable in size to the Live2D path below; what shipped instead is
  lightweight effects layered on top of the existing 2D art.
- Live2D-quality rigged animation was scoped and deliberately set aside
  for now (it needs pre-layered source art plus a real rigging pass in
  Cubism Editor, a much bigger lift than this project's scope); the
  current approach hand-builds detailed SVG art and animates it with CSS,
  aiming for a similar visual richness without the separate rigging tool.
