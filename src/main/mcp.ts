import { execFile } from 'child_process'
import { promisify } from 'util'
import type { McpSpec } from '@shared/types'
import { claudeBin, childPath } from './claudeBin'

const exec = promisify(execFile)
const run = (args: string[], opts: { cwd: string }) => exec(claudeBin(), args, { ...opts, env: { ...process.env, PATH: childPath() } })

function addArgs(s: McpSpec): string[] {
  const a = ['mcp', 'add', '-s', 'project', '-t', s.transport]
  for (const [k, v] of Object.entries(s.env ?? {})) a.push('-e', `${k}=${v}`)
  a.push(s.name)
  if (s.transport === 'stdio') a.push('--', s.command!, ...(s.args ?? []))
  else a.push(s.url!)
  return a
}

export async function applyMcps(cwd: string, specs: McpSpec[]): Promise<string> {
  let log = ''
  for (const s of specs) {
    try {
      await run(['mcp', 'remove', '-s', 'project', s.name], { cwd }).catch(() => {})
      const { stdout, stderr } = await run(addArgs(s), { cwd })
      log += `[${cwd}] ${stdout}${stderr}\n`
    } catch (e: any) { log += `[${cwd}] FAILED ${s.name}: ${e.stderr || e.message}\n` }
  }
  return log
}

export async function removeMcp(cwd: string, name: string): Promise<string> {
  try { const { stdout, stderr } = await run(['mcp', 'remove', '-s', 'project', name], { cwd }); return stdout + stderr }
  catch (e: any) { return `FAILED: ${e.stderr || e.message}` }
}
