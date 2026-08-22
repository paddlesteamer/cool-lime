import * as pty from 'node-pty'
import type { WebContents } from 'electron'
import { claudeBin, childPath } from './claudeBin'

const sessions = new Map<string, pty.IPty>()

export function startSession(id: string, cwd: string, wc: WebContents, cols = 120, rows = 30, model = '') {
  if (sessions.has(id)) return
  const p = pty.spawn(claudeBin(), ['--dangerously-skip-permissions', ...(model ? ['--model', model] : [])], {
    name: 'xterm-256color', cols, rows, cwd,
    env: { ...process.env, PATH: childPath(), TERM: 'xterm-256color', COLORTERM: 'truecolor', COOL_LIME: '1' } as any
  })
  sessions.set(id, p)
  p.onData((d) => { if (!wc.isDestroyed()) wc.send('pty:data', id, d) })
  p.onExit(({ exitCode }) => { sessions.delete(id); if (!wc.isDestroyed()) wc.send('pty:exit', id, exitCode) })
}
export const writeSession = (id: string, data: string) => sessions.get(id)?.write(data)
export const resizeSession = (id: string, cols: number, rows: number) => { try { sessions.get(id)?.resize(cols, rows) } catch {} }
export const killSession = (id: string) => { sessions.get(id)?.kill(); sessions.delete(id) }
export const hasSession = (id: string) => sessions.has(id)
export const killAll = () => { for (const p of sessions.values()) p.kill(); sessions.clear() }
