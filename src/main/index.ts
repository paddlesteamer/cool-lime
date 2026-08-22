import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import * as projects from './projects'
import * as ptyMgr from './pty'
import * as files from './files'
import * as mcp from './mcp'
import * as context from './context'

let win: BrowserWindow

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#1b1f1a',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
}

const handle = (ch: string, fn: (...a: any[]) => any) => ipcMain.handle(ch, (_e, ...a) => fn(...a))

// projects
handle('projects:list', projects.listProjects)
handle('projects:create', projects.createProject)
handle('projects:open', projects.openProject)
handle('projects:manifest', projects.readManifest)
handle('projects:addSubtopic', projects.addSubtopic)
handle('projects:renameSubtopic', projects.renameSubtopic)
handle('projects:deleteSubtopic', projects.deleteSubtopic)
handle('projects:updateSettings', projects.updateSettings)
handle('projects:addContextText', projects.addContextText)
handle('projects:importContextFiles', async (projectPath: string) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Documents', extensions: ['md', 'txt', 'pdf', 'docx', 'doc', 'csv', 'json'] }] })
  for (const f of r.filePaths) await projects.importContextFile(projectPath, f)
  return r.filePaths
})
handle('projects:revealInFinder', (p: string) => shell.showItemInFolder(p))

// context pipeline
handle('context:watch', (root: string) => context.startWatching(root, win.webContents))
handle('context:unwatch', context.stopWatching)
handle('context:regenerate', (root: string) => context.schedule(root))
handle('context:status', context.getStatus)

// mcp
handle('mcp:setProject', async (projectPath: string, specs: any[]) => {
  const m = await projects.readManifest(projectPath); m.mcps.project = specs; await projects.writeManifest(projectPath, m)
  let log = ''; for (const s of m.subtopics) log += await mcp.applyMcps(join(projectPath, s), specs); return log
})
handle('mcp:setSubtopic', async (projectPath: string, sub: string, specs: any[]) => {
  const m = await projects.readManifest(projectPath); m.mcps.subtopic[sub] = specs; await projects.writeManifest(projectPath, m)
  return mcp.applyMcps(join(projectPath, sub), specs)
})
handle('mcp:remove', async (projectPath: string, sub: string | null, name: string) => {
  const m = await projects.readManifest(projectPath); let log = ''
  if (sub) { m.mcps.subtopic[sub] = (m.mcps.subtopic[sub] ?? []).filter((s) => s.name !== name); log = await mcp.removeMcp(join(projectPath, sub), name) }
  else { m.mcps.project = m.mcps.project.filter((s) => s.name !== name); for (const s of m.subtopics) log += await mcp.removeMcp(join(projectPath, s), name) }
  await projects.writeManifest(projectPath, m); return log
})

// pty
handle('pty:start', (id: string, cwd: string, cols: number, rows: number, model?: string, kind?: ptyMgr.SessionKind) => ptyMgr.startSession(id, cwd, win.webContents, cols, rows, model, kind))
ipcMain.on('pty:write', (_e, id: string, d: string) => ptyMgr.writeSession(id, d))
ipcMain.on('pty:resize', (_e, id: string, c: number, r: number) => ptyMgr.resizeSession(id, c, r))
handle('pty:kill', ptyMgr.killSession)
handle('pty:killPrefix', ptyMgr.killPrefix)
handle('pty:has', ptyMgr.hasSession)

// files
handle('fs:tree', files.readTree)
handle('fs:read', files.readFile)
handle('fs:write', files.writeFile)
handle('fs:watch', (root: string) => files.watchDir(root, win.webContents))
handle('fs:unwatch', files.unwatch)

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { ptyMgr.killAll(); app.quit() })
