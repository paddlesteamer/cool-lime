import { promises as fs } from 'fs'
import { join, basename } from 'path'
import type { ProjectManifest, ProjectRef, ProjectSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { shell } from 'electron'
import { COOL_LIME_HOME, CONTEXT_DIR, CONTEXT_FILE, MANIFEST, PROJECTS_ROOT, REGISTRY_FILE } from './paths'
import { applyMcps } from './mcp'

const slug = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) } catch { return fallback }
}
async function writeJson(p: string, v: unknown) {
  await fs.mkdir(join(p, '..'), { recursive: true })
  await fs.writeFile(p, JSON.stringify(v, null, 2))
}

export async function listProjects(): Promise<ProjectRef[]> {
  const refs = await readJson<ProjectRef[]>(REGISTRY_FILE, [])
  const alive: ProjectRef[] = []
  for (const r of refs) { try { await fs.access(join(r.path, MANIFEST)); alive.push(r) } catch {} }
  return alive.sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
}

async function touchRegistry(ref: ProjectRef) {
  const refs = (await readJson<ProjectRef[]>(REGISTRY_FILE, [])).filter((r) => r.path !== ref.path)
  refs.push(ref)
  await fs.mkdir(COOL_LIME_HOME, { recursive: true })
  await writeJson(REGISTRY_FILE, refs)
}

export async function readManifest(projectPath: string): Promise<ProjectManifest> {
  const m = await readJson<ProjectManifest | null>(join(projectPath, MANIFEST), null)
  if (!m) throw new Error(`Not a Cool-Lime project: ${projectPath}`)
  m.settings = { ...DEFAULT_SETTINGS, ...(m.settings ?? {}) }
  return m
}
export async function writeManifest(projectPath: string, m: ProjectManifest) {
  await writeJson(join(projectPath, MANIFEST), m)
}

export const contextTemplate = (name: string) =>
  `# ${name} — Shared Context\n\n_This file is generated from the documents in \`context/\` and from subtopic notes. It is imported by every subtopic's CLAUDE.md._\n\n(No context yet. Add documents or text in Project Settings.)\n`

export const claudeMdTemplate = (project: string, subtopic: string) =>
  `# ${project} / ${subtopic}\n\n## Shared project context\n@../${CONTEXT_FILE}\n\n## Working rules\n- You are working on the subtopic **${subtopic}** of the project **${project}**.\n- Use \`./scratchpad/\` (relative to this folder) for ALL temporary and working files instead of /tmp.\n- Keep outputs the user should see in this folder so they can open them in Cool-Lime.\n- When you learn something that is relevant to the whole project (not just this subtopic), add it under "Subtopic notes" below; Cool-Lime distills these into the shared context.\n\n## Subtopic notes\n\n`

export async function createProject(name: string, contextText?: string): Promise<ProjectRef> {
  const path = join(PROJECTS_ROOT, slug(name))
  try { await fs.access(path); throw new Error(`Project folder already exists: ${path}`) } catch (e: any) { if (e.code !== 'ENOENT') throw e }
  await fs.mkdir(join(path, CONTEXT_DIR), { recursive: true })
  const manifest: ProjectManifest = { name, created: new Date().toISOString(), subtopics: [], mcps: { project: [], subtopic: {} } }
  await writeManifest(path, manifest)
  await fs.writeFile(join(path, CONTEXT_FILE), contextTemplate(name))
  if (contextText?.trim()) await fs.writeFile(join(path, CONTEXT_DIR, 'initial-context.md'), contextText)
  const ref = { name, path, lastOpened: new Date().toISOString() }
  await touchRegistry(ref)
  return ref
}

export async function openProject(path: string): Promise<{ ref: ProjectRef; manifest: ProjectManifest }> {
  const manifest = await readManifest(path)
  const ref = { name: manifest.name, path, lastOpened: new Date().toISOString() }
  await touchRegistry(ref)
  return { ref, manifest }
}

export async function addSubtopic(projectPath: string, name: string): Promise<ProjectManifest> {
  const m = await readManifest(projectPath)
  const dir = slug(name)
  if (m.subtopics.includes(dir)) throw new Error(`Subtopic exists: ${dir}`)
  const sub = join(projectPath, dir)
  await fs.mkdir(join(sub, 'scratchpad'), { recursive: true })
  await fs.writeFile(join(sub, 'CLAUDE.md'), claudeMdTemplate(m.name, name))
  m.subtopics.push(dir)
  await writeManifest(projectPath, m)
  await applyMcps(sub, m.mcps.project)
  return m
}

export async function importContextFile(projectPath: string, srcPath: string) {
  await fs.copyFile(srcPath, join(projectPath, CONTEXT_DIR, basename(srcPath)))
}
export async function addContextText(projectPath: string, title: string, text: string) {
  await fs.writeFile(join(projectPath, CONTEXT_DIR, `${slug(title)}.md`), text)
}

export async function updateSettings(projectPath: string, patch: Partial<ProjectSettings>): Promise<ProjectManifest> {
  const m = await readManifest(projectPath)
  m.settings = { ...m.settings!, ...patch }
  await writeManifest(projectPath, m)
  return m
}

export async function renameSubtopic(projectPath: string, from: string, to: string): Promise<ProjectManifest> {
  const m = await readManifest(projectPath)
  const dir = slug(to)
  if (!m.subtopics.includes(from)) throw new Error(`No such subtopic: ${from}`)
  if (m.subtopics.includes(dir)) throw new Error(`Subtopic exists: ${dir}`)
  await fs.rename(join(projectPath, from), join(projectPath, dir))
  m.subtopics = m.subtopics.map((s) => (s === from ? dir : s))
  if (m.mcps.subtopic[from]) { m.mcps.subtopic[dir] = m.mcps.subtopic[from]; delete m.mcps.subtopic[from] }
  await writeManifest(projectPath, m)
  return m
}

/** Moves the subtopic folder to the Trash (recoverable) and drops it from the manifest. */
export async function deleteSubtopic(projectPath: string, name: string): Promise<ProjectManifest> {
  const m = await readManifest(projectPath)
  if (!m.subtopics.includes(name)) throw new Error(`No such subtopic: ${name}`)
  await shell.trashItem(join(projectPath, name))
  m.subtopics = m.subtopics.filter((s) => s !== name)
  delete m.mcps.subtopic[name]
  await writeManifest(projectPath, m)
  return m
}
