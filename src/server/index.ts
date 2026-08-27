import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { join } from 'path'
import * as projects from '../main/projects'
import * as ptyMgr from '../main/pty'
import * as files from '../main/files'
import * as context from '../main/context'
import * as mcp from '../main/mcp'

const PORT = Number(process.env.COOL_LIME_PORT || 7420)
const HOST = process.env.COOL_LIME_HOST || '127.0.0.1' // set 0.0.0.0 (or a tailscale IP) to expose
const TOKEN = process.env.COOL_LIME_TOKEN || ''

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const broadcast: ptyMgr.Sender = (t, ...a) => {
  const msg = JSON.stringify({ t, a })
  for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(msg)
}
ptyMgr.setBroadcast(broadcast)

const authed = (req: express.Request) => !TOKEN || req.headers['x-lime-token'] === TOKEN || req.query.token === TOKEN
app.use((req, res, next) => (authed(req) ? next() : res.status(401).json({ error: 'unauthorized' })))

// Same surface as the Electron preload bridge.
const methods: Record<string, (...a: any[]) => any> = {
  'projects.list': projects.listProjects,
  'projects.create': projects.createProject,
  'projects.open': projects.openProject,
  'projects.manifest': projects.readManifest,
  'projects.addSubtopic': projects.addSubtopic,
  'projects.renameSubtopic': projects.renameSubtopic,
  'projects.deleteSubtopic': projects.deleteSubtopic,
  'projects.updateSettings': projects.updateSettings,
  'projects.addContextText': projects.addContextText,
  'projects.revealInFinder': () => false, // meaningless on a remote server
  'mcp.setProject': async (projectPath: string, specs: any[]) => {
    const m = await projects.readManifest(projectPath); m.mcps.project = specs; await projects.writeManifest(projectPath, m)
    let log = ''; for (const s of m.subtopics) log += await mcp.applyMcps(join(projectPath, s), specs); return log
  },
  'mcp.setSubtopic': async (projectPath: string, sub: string, specs: any[]) => {
    const m = await projects.readManifest(projectPath); m.mcps.subtopic[sub] = specs; await projects.writeManifest(projectPath, m)
    return mcp.applyMcps(join(projectPath, sub), specs)
  },
  'mcp.remove': async (projectPath: string, sub: string | null, name: string) => {
    const m = await projects.readManifest(projectPath); let log = ''
    if (sub) { m.mcps.subtopic[sub] = (m.mcps.subtopic[sub] ?? []).filter((s) => s.name !== name); log = await mcp.removeMcp(join(projectPath, sub), name) }
    else { m.mcps.project = m.mcps.project.filter((s) => s.name !== name); for (const s of m.subtopics) log += await mcp.removeMcp(join(projectPath, s), name) }
    await projects.writeManifest(projectPath, m); return log
  },
  'context.watch': (root: string) => context.startWatching(root, broadcast),
  'context.unwatch': context.stopWatching,
  'context.regenerate': (root: string) => context.schedule(root),
  'context.status': context.getStatus,
  'pty.start': ptyMgr.startSession,
  'pty.kill': ptyMgr.killSession,
  'pty.killPrefix': ptyMgr.killPrefix,
  'pty.has': ptyMgr.hasSession,
  'fs.tree': files.readTree,
  'fs.read': files.readFile,
  'fs.write': files.writeFile,
  'fs.watch': (root: string) => files.watchDir(root, broadcast),
  'fs.unwatch': files.unwatch
}

app.post('/api/rpc', express.json({ limit: '20mb' }), async (req, res) => {
  const { method, args = [] } = req.body ?? {}
  const fn = methods[method]
  if (!fn) return res.status(400).json({ error: `unknown method: ${method}` })
  try { res.json({ result: (await fn(...args)) ?? null }) }
  catch (e: any) { res.status(400).json({ error: e.message || String(e) }) }
})

app.put('/api/upload', express.raw({ limit: '200mb', type: () => true }), async (req, res) => {
  const project = String(req.query.project || ''); const name = String(req.query.name || '')
  if (!project || !name) return res.status(400).json({ error: 'project and name required' })
  try { await projects.addContextBuffer(project, name, req.body as Buffer); res.json({ result: name }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})

app.use(express.static(join(__dirname, '../renderer')))

wss.on('connection', (sock, req) => {
  if (TOKEN && new URL(req.url || '', 'http://x').searchParams.get('token') !== TOKEN) { sock.close(4001, 'unauthorized'); return }
  sock.on('message', (raw) => {
    try {
      const m = JSON.parse(String(raw))
      if (m.t === 'pty:write') ptyMgr.writeSession(m.id, m.data)
      else if (m.t === 'pty:resize') ptyMgr.resizeSession(m.id, m.cols, m.rows)
    } catch {}
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Cool-Lime server on http://${HOST}:${PORT}${TOKEN ? ' (token required)' : ''}`)
})
process.on('SIGINT', () => { ptyMgr.killAll(); process.exit(0) })
process.on('SIGTERM', () => { ptyMgr.killAll(); process.exit(0) })
