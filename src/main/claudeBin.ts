import { accessSync, constants } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'

let cached: string | null = null

/** Resolve the Claude Code binary: explicit env, common install paths, then PATH via login shell. */
export function claudeBin(): string {
  if (cached) return cached
  const candidates = [
    process.env.COOL_LIME_CLAUDE,
    join(homedir(), '.local/bin/claude'),
    join(homedir(), '.claude/local/claude'),
    '/opt/homebrew/bin/claude', '/usr/local/bin/claude'
  ].filter(Boolean) as string[]
  for (const c of candidates) { try { accessSync(c, constants.X_OK); return (cached = c) } catch {} }
  try {
    const p = execFileSync(process.env.SHELL || '/bin/zsh', ['-lc', 'command -v claude'], { encoding: 'utf8' }).trim()
    if (p) return (cached = p)
  } catch {}
  return (cached = 'claude')
}

/** PATH for child processes: user's login-shell PATH plus the bin dir of the resolved claude. */
export function childPath(): string {
  let p = process.env.PATH || ''
  try { p = execFileSync(process.env.SHELL || '/bin/zsh', ['-lc', 'echo $PATH'], { encoding: 'utf8' }).trim() || p } catch {}
  const dir = join(claudeBin(), '..')
  return p.includes(dir) ? p : `${dir}:${p}`
}
