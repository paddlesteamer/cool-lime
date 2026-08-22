# Cool-Lime

A GUI harness around Claude Code: projects with shared context, each subtopic a live `claude --dangerously-skip-permissions` session, with the subtopic's files editable alongside.

See `PLAN.md` for the design.

## Dev
```
npm install      # rebuilds node-pty for Electron
npm run dev
```
Projects are created under `~/CoolLime/<project>/`. Set `COOL_LIME_CLAUDE=/path/to/claude` if the binary isn't auto-detected.
