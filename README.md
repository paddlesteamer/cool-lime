# Cool-Lime

A GUI harness around Claude Code: projects with shared context, each subtopic a live `claude --dangerously-skip-permissions` session, with the subtopic's files editable alongside.

See `PLAN.md` for the design.

## Dev
```
npm install      # rebuilds node-pty for Electron
npm run dev
```
Projects are created under `~/CoolLime/<project>/`. Set `COOL_LIME_CLAUDE=/path/to/claude` if the binary isn't auto-detected.

## Server mode (use from a browser / remotely)

```
npm run serve            # builds, then serves UI + API on http://127.0.0.1:7420
```

Open http://127.0.0.1:7420 in a browser — same UI, same projects, terminals stream over WebSocket.
The machine running `serve` is where projects live (`~/CoolLime`) and where Claude Code runs.

Env vars:
- `COOL_LIME_HOST=0.0.0.0` (or your Tailscale IP) to accept remote connections
- `COOL_LIME_TOKEN=<secret>` to require auth; open the UI as `http://host:7420/?token=<secret>`
- `COOL_LIME_PORT` (default 7420)

For a VPS/home server: run it behind Tailscale (`COOL_LIME_HOST=$(tailscale ip -4)`) and set a token.
The server runs via `ELECTRON_RUN_AS_NODE`, reusing Electron's Node so the native pty module needs no rebuild.
Notes: browser mode hides nothing except "Reveal in Finder" (no-op remotely). A browser refresh reconnects and
repaints terminals from a 200KB scrollback buffer; sessions keep running server-side.
