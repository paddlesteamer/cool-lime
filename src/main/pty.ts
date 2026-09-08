import * as pty from 'node-pty'
import { readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { claudeBin, childPath } from './claudeBin'

/** GUI-launched Electron often has no locale in env; without a UTF-8 locale zsh/claude mangle non-ASCII (e.g. Turkish) output. */
function utf8Locale(): Record<string, string> {
  const lang = process.env.LANG && /utf-?8/i.test(process.env.LANG) ? process.env.LANG : 'en_US.UTF-8'
  return { LANG: lang, LC_ALL: process.env.LC_ALL && /utf-?8/i.test(process.env.LC_ALL) ? process.env.LC_ALL : lang }
}

export type Sender = (ch: string, ...args: any[]) => void
export type SessionKind = 'claude' | 'shell'

const BUF_MAX = 200_000
const sessions = new Map<string, { p: pty.IPty; buf: string }>()
let broadcast: Sender = () => {}
export const setBroadcast = (fn: Sender) => { broadcast = fn }

/** True if Claude Code has a saved conversation for this cwd (~/.claude/projects/<encoded cwd>/*.jsonl). */
export function hasClaudeHistory(cwd: string): boolean {
  const dir = join(homedir(), '.claude', 'projects', cwd.replace(/[/.]/g, '-'))
  try { return readdirSync(dir).some((f) => f.endsWith('.jsonl')) } catch { return false }
}

/** Starts (or reuses) a session. Returns buffered scrollback so a reconnecting client can repaint. */
export function startSession(id: string, cwd: string, cols = 120, rows = 30, model = '', kind: SessionKind = 'claude'): string {
  const existing = sessions.get(id)
  if (existing) return existing.buf
  const [bin, args] = kind === 'shell'
    ? [process.env.SHELL || '/bin/zsh', ['-l']]
    : [claudeBin(), ['--dangerously-skip-permissions', ...(hasClaudeHistory(cwd) ? ['--continue'] : []), ...(model ? ['--model', model] : [])]]
  const p = pty.spawn(bin, args, {
    name: 'xterm-256color', cols, rows, cwd,
    env: { ...process.env, ...utf8Locale(), PATH: childPath(), TERM: 'xterm-256color', COLORTERM: 'truecolor', COOL_LIME: '1' } as any
  })
  const s = { p, buf: '' }
  sessions.set(id, s)
  p.onData((d) => { s.buf = (s.buf + d).slice(-BUF_MAX); broadcast('pty:data', id, d) })
  p.onExit(({ exitCode }) => { sessions.delete(id); broadcast('pty:exit', id, exitCode) })
  return ''
}
export const writeSession = (id: string, data: string) => sessions.get(id)?.p.write(data)
export const resizeSession = (id: string, cols: number, rows: number) => { try { sessions.get(id)?.p.resize(cols, rows) } catch {} }
export const killSession = (id: string) => { sessions.get(id)?.p.kill(); sessions.delete(id) }
export const killPrefix = (prefix: string) => { for (const [id, s] of sessions) if (id === prefix || id.startsWith(prefix + '/') || id.startsWith(prefix + '#')) { s.p.kill(); sessions.delete(id) } }
export const hasSession = (id: string) => sessions.has(id)
export const killAll = () => { for (const s of sessions.values()) s.p.kill(); sessions.clear() }
