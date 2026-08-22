import * as pty from 'node-pty'
import type { WebContents } from 'electron'
import { readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { claudeBin, childPath } from './claudeBin'

const sessions = new Map<string, pty.IPty>()

export type SessionKind = 'claude' | 'shell'

/** True if Claude Code has a saved conversation for this cwd (~/.claude/projects/<encoded cwd>/*.jsonl). */
export function hasClaudeHistory(cwd: string): boolean {
  const dir = join(homedir(), '.claude', 'projects', cwd.replace(/[/.]/g, '-'))
  try { return readdirSync(dir).some((f) => f.endsWith('.jsonl')) } catch { return false }
}

export function startSession(id: string, cwd: string, wc: WebContents, cols = 120, rows = 30, model = '', kind: SessionKind = 'claude') {
  if (sessions.has(id)) return
  const [bin, args] = kind === 'shell'
    ? [process.env.SHELL || '/bin/zsh', ['-l']]
    : [claudeBin(), ['--dangerously-skip-permissions', ...(hasClaudeHistory(cwd) ? ['--continue'] : []), ...(model ? ['--model', model] : [])]]
  const p = pty.spawn(bin, args, {
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
export const killPrefix = (prefix: string) => { for (const [id, p] of sessions) if (id === prefix || id.startsWith(prefix + '/') || id.startsWith(prefix + '#')) { p.kill(); sessions.delete(id) } }
export const hasSession = (id: string) => sessions.has(id)
export const killAll = () => { for (const p of sessions.values()) p.kill(); sessions.clear() }
