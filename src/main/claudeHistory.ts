import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const encode = (cwd: string) => cwd.replace(/[/.]/g, '-')

/** Moves Claude Code's per-cwd state when a folder is renamed: the history dir
 *  (~/.claude/projects/<encoded cwd>, rewriting cwd fields in its .jsonl files)
 *  and the per-path entry (trust, etc.) in ~/.claude.json. Best-effort. */
export async function migrateClaudeHistory(oldCwd: string, newCwd: string): Promise<void> {
  if (oldCwd === newCwd) return
  const base = join(homedir(), '.claude', 'projects')
  const oldDir = join(base, encode(oldCwd))
  const newDir = join(base, encode(newCwd))
  try {
    await fs.rename(oldDir, newDir)
    for (const f of await fs.readdir(newDir)) {
      if (!f.endsWith('.jsonl')) continue
      const p = join(newDir, f)
      const t = await fs.readFile(p, 'utf8')
      const oldJson = JSON.stringify(oldCwd).slice(1, -1)
      if (t.includes(`"cwd":"${oldJson}"`)) await fs.writeFile(p, t.replaceAll(`"cwd":"${oldJson}"`, `"cwd":"${JSON.stringify(newCwd).slice(1, -1)}"`))
    }
  } catch {}
  try {
    const cfgPath = join(homedir(), '.claude.json')
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8'))
    if (cfg.projects?.[oldCwd] && !cfg.projects[newCwd]) {
      cfg.projects[newCwd] = cfg.projects[oldCwd]
      delete cfg.projects[oldCwd]
      await fs.writeFile(cfgPath, JSON.stringify(cfg))
    }
  } catch {}
}
