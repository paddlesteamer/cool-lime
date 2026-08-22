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
  const [showLeft, setShowLeft] = useState(true)
  const [showRight, setShowRight] = useState(true)
  const [showCenter, setShowCenter] = useState(true)
  const STRIP = 30
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); setShellOpen((o) => !o) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); setShowLeft((o) => !o) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') { e.preventDefault(); setShowRight((o) => !o) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') { e.preventDefault(); setShowCenter((o) => !o) } }
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
        {project && <div className="tb-actions">
          <button className="ghost icon" title="Project settings" aria-label="Project settings" onClick={() => setSettingsOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
          </button>
          <button className="ghost icon" title="Close project" aria-label="Close project" onClick={closeProject}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>}
      </div>
      {!project || !manifest ? <StartScreen onOpen={open} /> : (
        <div className="layout" style={{ gridTemplateColumns: `${showLeft ? `${sizes[0]}px 4px` : `${STRIP}px`} ${showCenter ? '1fr' : `${STRIP}px`} ${showRight ? `4px ${sizes[1]}px` : `${STRIP}px`}` }}>
          {!showLeft && <Strip label="Sidebar" onClick={() => setShowLeft(true)} />}
          <div className={`pane ${showLeft ? '' : 'hidden'}`}>
            <Sidebar project={project} manifest={manifest} subtopic={subtopic} opened={opened} onSelect={(s) => { setSubtopic(s); setExternalFile(null) }} onAdd={addSubtopic} onRename={renameSubtopic} onDelete={deleteSubtopic} ctxStatus={ctxStatus} onOpenFile={setExternalFile} onRegenerate={() => window.lime.context.regenerate(project.path)} onCollapse={() => setShowLeft(false)} />
          </div>
          {showLeft && <div className="gutter" onMouseDown={drag(0)} />}
          {!showCenter && <Strip label="Claude" onClick={() => setShowCenter(true)} />}
          <div className={`pane center ${showCenter ? '' : 'hidden'}`}>
            {subtopic ? <>
              <TerminalPane projectPath={project.path} opened={opened} active={subtopic} model={manifest.settings?.sessionModel ?? ''} onCollapse={() => setShowCenter(false)} />
              <ShellPanel projectPath={project.path} subtopic={subtopic} open={shellOpen} onToggle={() => setShellOpen((o) => !o)} />
            </> : <div className="empty">No subtopics yet.<br />Add one from the sidebar to start a Claude Code session.</div>}
          </div>
          {showRight && <div className="gutter" onMouseDown={drag(1)} />}
          {!showRight && <Strip label="Files" onClick={() => setShowRight(true)} />}
          <div className={`pane ${showRight ? '' : 'hidden'}`}>
            <FilePane root={subtopic ? `${project.path}/${subtopic}` : null} externalFile={externalFile} onCollapse={() => setShowRight(false)} />
          </div>
        </div>
      )}
      {settingsOpen && project && manifest && <ProjectSettings project={project} manifest={manifest} subtopic={subtopic} onClose={() => { setSettingsOpen(false); refresh() }} />}
    </>
  )
}

function Strip({ label, onClick }: { label: string; onClick: () => void }) {
  return <div className="strip" title={`Show ${label}`} onClick={onClick}><span className="glyph">▸</span><span className="vlabel">{label}</span></div>
}
