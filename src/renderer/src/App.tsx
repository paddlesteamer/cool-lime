import React, { useCallback, useEffect, useState } from 'react'
import type { ContextStatus, ProjectManifest, ProjectRef } from '@shared/types'
import StartScreen from './components/StartScreen'
import Sidebar from './components/Sidebar'
import TerminalPane from './components/TerminalPane'
import FilePane from './components/FilePane'
import ShellPanel from './components/ShellPanel'
import ProjectSettings from './components/ProjectSettings'

export default function App() {
  const [project, setProject] = useState<ProjectRef | null>(null)
  const [manifest, setManifest] = useState<ProjectManifest | null>(null)
  const [subtopic, setSubtopic] = useState<string | null>(null)
  const [opened, setOpened] = useState<string[]>([]) // subtopics with live terminals
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ctxStatus, setCtxStatus] = useState<ContextStatus>({ state: 'idle' })
  const [externalFile, setExternalFile] = useState<string | null>(null)
  const [shellOpen, setShellOpen] = useState(false)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); setShellOpen((o) => !o) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => window.lime.context.onStatus(setCtxStatus), [])
  useEffect(() => {
    if (!project) return
    window.lime.context.watch(project.path)
    return () => { window.lime.context.unwatch() }
  }, [project?.path])

  const open = useCallback(async (path: string) => {
    const { ref, manifest } = await window.lime.projects.open(path)
    setProject(ref); setManifest(manifest); setSubtopic(manifest.subtopics[0] ?? null); setOpened([]); setExternalFile(null)
  }, [])

  const refresh = useCallback(async () => { if (project) setManifest(await window.lime.projects.manifest(project.path)) }, [project])

  const addSubtopic = async (name: string) => {
    if (!project) return
    const m = await window.lime.projects.addSubtopic(project.path, name)
    setManifest(m); setSubtopic(m.subtopics[m.subtopics.length - 1])
  }
  const renameSubtopic = async (from: string, to: string) => {
    if (!project) return
    await window.lime.pty.killPrefix(`${project.path}/${from}`)
    const m = await window.lime.projects.renameSubtopic(project.path, from, to)
    const dir = m.subtopics.find((s: string) => !manifest!.subtopics.includes(s)) ?? from
    setOpened((o) => o.filter((s) => s !== from)); setManifest(m); if (subtopic === from) setSubtopic(dir)
  }
  const deleteSubtopic = async (name: string) => {
    if (!project) return
    await window.lime.pty.killPrefix(`${project.path}/${name}`)
    const m = await window.lime.projects.deleteSubtopic(project.path, name)
    setOpened((o) => o.filter((s) => s !== name)); setManifest(m); if (subtopic === name) setSubtopic(m.subtopics[0] ?? null)
  }
  const [sizes, setSizes] = useState<[number, number]>(() => { try { return JSON.parse(localStorage.getItem('lime.sizes') || '') } catch { return [220, 380] } })
  const drag = (which: 0 | 1) => (e: React.MouseEvent) => {
    e.preventDefault(); const startX = e.clientX; const start = sizes[which]
    const move = (ev: MouseEvent) => { const d = ev.clientX - startX; const next: [number, number] = [...sizes]; next[which] = Math.max(160, which === 0 ? start + d : start - d); setSizes(next); localStorage.setItem('lime.sizes', JSON.stringify(next)) }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  useEffect(() => { if (subtopic && !opened.includes(subtopic)) setOpened((o) => [...o, subtopic]) }, [subtopic])

  const closeProject = () => { window.lime.pty.killPrefix(project!.path); window.lime.fs.unwatch(); setProject(null); setManifest(null); setSubtopic(null); setOpened([]) }

  return (
    <>
      <div className="titlebar">
        <b>Cool-Lime</b>{project ? <span>{project.name}{subtopic ? ` / ${subtopic}` : ''}</span> : <span>harness for Claude Code</span>}
        {project && <div className="right"><button className="ghost" onClick={() => setSettingsOpen(true)}>Project settings</button><button className="ghost" onClick={closeProject}>Close project</button></div>}
      </div>
      {!project || !manifest ? <StartScreen onOpen={open} /> : (
        <div className="layout" style={{ gridTemplateColumns: `${sizes[0]}px 4px 1fr 4px ${sizes[1]}px` }}>
          <Sidebar project={project} manifest={manifest} subtopic={subtopic} opened={opened} onSelect={(s) => { setSubtopic(s); setExternalFile(null) }} onAdd={addSubtopic} onRename={renameSubtopic} onDelete={deleteSubtopic} ctxStatus={ctxStatus} onOpenFile={setExternalFile} onRegenerate={() => window.lime.context.regenerate(project.path)} />
          <div className="gutter" onMouseDown={drag(0)} />
          <div className="center">
            {subtopic ? <>
              <TerminalPane projectPath={project.path} opened={opened} active={subtopic} model={manifest.settings?.sessionModel ?? ''} />
              <ShellPanel projectPath={project.path} subtopic={subtopic} open={shellOpen} onToggle={() => setShellOpen((o) => !o)} />
            </> : <div className="empty">No subtopics yet.<br />Add one from the sidebar to start a Claude Code session.</div>}
          </div>
          <div className="gutter" onMouseDown={drag(1)} />
          <FilePane root={subtopic ? `${project.path}/${subtopic}` : null} externalFile={externalFile} />
        </div>
      )}
      {settingsOpen && project && manifest && <ProjectSettings project={project} manifest={manifest} subtopic={subtopic} onClose={() => { setSettingsOpen(false); refresh() }} />}
    </>
  )
}
