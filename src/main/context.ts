import { promises as fs } from 'fs'
import { join, relative, sep } from 'path'
import { execFile } from 'child_process'
import chokidar, { FSWatcher } from 'chokidar'
import type { WebContents } from 'electron'
import type { ContextStatus } from '@shared/types'
import { claudeBin, childPath } from './claudeBin'
import { CONTEXT_DIR, CONTEXT_FILE } from './paths'
import { readManifest } from './projects'

const DEBOUNCE_MS = 2500
let watcher: FSWatcher | null = null
let timer: NodeJS.Timeout | null = null
let running = false
let pending = false
let status: ContextStatus = { state: 'idle' }
let wcRef: WebContents | null = null
let projectRoot: string | null = null

function setStatus(s: ContextStatus) { status = s; if (wcRef && !wcRef.isDestroyed()) wcRef.send('context:status', s) }
export const getStatus = () => status

const PROMPT = (project: string, subtopics: string[]) => `You are the context curator for the project "${project}".
Produce the complete contents of CONTEXT.md: a concise, well-structured shared-context document that every subtopic agent of this project imports.

Sources (read ALL of them with your tools; they are relative to the current directory):
1. Every file in ./${CONTEXT_DIR}/ — the user's raw project context (markdown, text, PDF, Word, CSV ...). This is the primary source.
2. The "## Subtopic notes" section of each subtopic's CLAUDE.md: ${subtopics.map((s) => `./${s}/CLAUDE.md`).join(', ') || '(none yet)'}. Include facts from there only if they are relevant project-wide, and attribute them like "(from ${'<subtopic>'})".
3. The existing ./${CONTEXT_FILE} — preserve anything still valid that is not contradicted by newer sources.

Rules:
- Output ONLY the markdown for CONTEXT.md. No preamble, no code fence, no commentary.
- Start with "# ${project} — Shared Context".
- Sections to use when applicable: Overview, Goals, Constraints & decisions, Key facts & data, Glossary, Open questions, Sources (list the files you used).
- Be faithful to the sources; do not invent. Keep it dense: this is loaded into every agent's context, so aim for under ~1500 words.
- Subtopics that exist: ${subtopics.join(', ') || '(none yet)'}.`

async function runOnce(root: string) {
  const m = await readManifest(root)
  setStatus({ state: 'running', message: 'Distilling context…' })
  const started = Date.now()
  const out = await new Promise<string>((resolve, reject) => {
    const child = execFile(claudeBin(), ['-p', '--output-format', 'text', '--allowedTools', 'Read,Glob,Grep,LS', ...(m.settings?.curatorModel ? ['--model', m.settings.curatorModel] : [])],
      { cwd: root, env: { ...process.env, PATH: childPath() }, maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60 * 1000 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)))
    child.stdin?.end(PROMPT(m.name, m.subtopics))
  })
  const text = out.trim().replace(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/m, '$1')
  if (!text.startsWith('#')) throw new Error(`Unexpected agent output: ${text.slice(0, 200)}`)
  await fs.writeFile(join(root, CONTEXT_FILE), text + '\n')
  setStatus({ state: 'idle', message: `Updated in ${Math.round((Date.now() - started) / 1000)}s`, lastRun: new Date().toISOString() })
}

async function drain(root: string) {
  if (running) { pending = true; return }
  running = true
  try {
    do { pending = false; await runOnce(root) } while (pending)
  } catch (e: any) { setStatus({ state: 'error', message: e.message?.slice(0, 400) }) }
  finally { running = false }
}

export function schedule(root = projectRoot) {
  if (!root) return
  if (timer) clearTimeout(timer)
  setStatus({ ...status, state: running ? 'running' : 'idle', message: 'Change detected, update queued…' })
  timer = setTimeout(() => drain(root), DEBOUNCE_MS)
}

/** Triggers: anything under context/, or <subtopic>/CLAUDE.md. CONTEXT.md itself is never a trigger (no self-loop). */
function isTrigger(root: string, p: string) {
  const r = relative(root, p).split(sep)
  return r[0] === CONTEXT_DIR || (r.length === 2 && r[1] === 'CLAUDE.md')
}

export function startWatching(root: string, wc: WebContents) {
  stopWatching()
  projectRoot = root; wcRef = wc
  watcher = chokidar.watch(root, {
    ignored: (p) => p.split(sep).some((s) => s === 'node_modules' || s === '.git' || s === 'scratchpad'),
    ignoreInitial: true, depth: 2, awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  })
  const onEvt = async (p: string) => { if (isTrigger(root, p) && (await readManifest(root)).settings?.autoContext !== false) schedule(root) }
  watcher.on('add', onEvt).on('change', onEvt).on('unlink', onEvt)
  setStatus({ state: 'idle' })
}

export function stopWatching() {
  watcher?.close(); watcher = null
  if (timer) clearTimeout(timer); timer = null
  projectRoot = null
}
