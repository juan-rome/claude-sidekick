const http = require('node:http');
const { stateForHookEvent, REACTION_HOLD_MS } = require('./hookState');

const DEFAULT_PORT = 8934;

/**
 * A tiny local HTTP server Claude Code's hooks POST to. Deliberately not
 * using Express or any dependency: this only ever needs to accept one kind
 * of request (a JSON hook payload on the configured path) from localhost.
 *
 * `onState(state)` fires whenever the mapped state changes. Reactive
 * states (anything but 'idle'/'working'/'question') automatically
 * revert to 'idle' after REACTION_HOLD_MS so the character doesn't get
 * stuck mid-reaction if no further hook events arrive. 'question' holds
 * instead, since "waiting on you" can outlast a normal reaction by a lot.
 */
function startHookServer({ port = DEFAULT_PORT, onState } = {}) {
  let revertTimer = null;

  function setState(state) {
    if (revertTimer) {
      clearTimeout(revertTimer);
      revertTimer = null;
    }
    onState(state);
    // question is excluded too: "waiting on you" (a permission prompt,
    // an idle timeout) can last far longer than a normal reaction hold,
    // so it stays up until the next real event replaces it.
    if (state !== 'idle' && state !== 'working' && state !== 'question') {
      revertTimer = setTimeout(() => onState('idle'), REACTION_HOLD_MS);
    }
  }

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const state = stateForHookEvent(payload);
        if (state) setState(state);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      } catch {
        res.writeHead(400).end();
      }
    });
  });

  // An unhandled 'error' event on an http.Server throws and crashes the
  // whole main process; a stale dev instance still holding the port
  // (or any other bind failure) would otherwise take Sidekick down
  // silently before its window ever gets a chance to show.
  server.on('error', (err) => {
    console.error('[hookServer] failed to start:', err.message);
  });

  server.listen(port, '127.0.0.1');

  return {
    server,
    close: () => {
      if (revertTimer) clearTimeout(revertTimer);
      server.close();
    },
  };
}

module.exports = { startHookServer, DEFAULT_PORT };
