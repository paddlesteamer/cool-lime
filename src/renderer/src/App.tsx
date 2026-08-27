import React, { useCallback, useEffect, useState } from 'react'
import type { ContextStatus, ProjectManifest, ProjectRef } from '@shared/types'
import StartScreen from './components/StartScreen'
import Sidebar from './components/Sidebar'
import TerminalPane from './components/TerminalPane'
import FilePane from './components/FilePane'
import ShellPanel from './components/ShellPanel'
import ProjectSettings from './components/ProjectSettings'

export interface OpenProj { ref: ProjectRef; manifest: ProjectManifest }

export default function App() {
  const [projs, setProjs] = useState<OpenProj[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [subByProj, setSubByProj] = useState<Record<string, string | null>>({})
  const [opened, setOpened] = useState<string[]>([]) // live session keys `${projectPath}/${subtopic}`
  const [restored, setRestored] = useState(false)
  const [adding, setAdding] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ctxStatus, setCtxStatus] = useState<Record<string, ContextStatus>>({})
  const [externalFile, setExternalFile] = useState<string | null>(null)
  const [shellOpen, setShellOpen] = useState(false)
  const [showLeft, setShowLeft] = useState(true)
  const [showRight, setShowRight] = useState(true)
  const [showCenter, setShowCenter] = useState(true)
  const STRIP = 30

  const active = projs.find((p) => p.ref.path === activePath) ?? null
  const subtopic = activePath ? subByProj[activePath] ?? null : null
  const activeKey = activePath && subtopic ? `${activePath}/${subtopic}` : null

  useEffect(() => window.lime.context.onStatus((root: string, s: ContextStatus) => setCtxStatus((m) => ({ ...m, [root]: s }))), [])

  const open = useCallback(async (path: string) => {
    setAdding(false)
    const { ref, manifest } = await window.lime.projects.open(path)
    setProjs((ps) => [...ps.filter((p) => p.ref.path !== path), { ref, manifest }])
    setSubByProj((m) => ({ ...m, [path]: m[path] && manifest.subtopics.includes(m[path]!) ? m[path] : manifest.subtopics[0] ?? null }))
    setActivePath(path)
    window.lime.context.watch(path)
  }, [])

  // Restore where we left off.
  useEffect(() => {
    ;(async () => {
      try {
        const saved = JSON.parse(localStorage.getItem('lime.session') || '{}')
        if (saved.subs) setSubByProj(saved.subs)
        for (const path of saved.paths ?? []) { try { await open(path) } catch {} }
        if (saved.active && (saved.paths ?? []).includes(saved.active)) setActivePath(saved.active)
      } finally { setRestored(true) }
    })()
  }, [])
  useEffect(() => {
    if (!restored) return
    localStorage.setItem('lime.session', JSON.stringify({ paths: projs.map((p) => p.ref.path), active: activePath, subs: subByProj }))
  }, [projs, activePath, subByProj, restored])

  useEffect(() => { if (activeKey) setOpened((o) => (o.includes(activeKey) ? o : [...o, activeKey])) }, [activeKey])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); setShellOpen((o) => !o) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); setShowLeft((o) => !o) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') { e.preventDefault(); setShowRight((o) => !o) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') { e.preventDefault(); setShowCenter((o) => !o) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const setManifest = (path: string, m: ProjectManifest) => setProjs((ps) => ps.map((p) => (p.ref.path === path ? { ...p, manifest: m } : p)))
  const refresh = async (path: string) => setManifest(path, await window.lime.projects.manifest(path))

  const addSubtopic = async (name: string) => {
    if (!activePath) return
    const m = await window.lime.projects.addSubtopic(activePath, name)
    setManifest(activePath, m)
    setSubByProj((s) => ({ ...s, [activePath]: m.subtopics[m.subtopics.length - 1] }))
  }
  const renameSubtopic = async (from: string, to: string) => {
    if (!activePath || !active) return
    await window.lime.pty.killPrefix(`${activePath}/${from}`)
    const m = await window.lime.projects.renameSubtopic(activePath, from, to)
    const dir = m.subtopics.find((s: string) => !active.manifest.subtopics.includes(s)) ?? from
    setOpened((o) => o.filter((k) => k !== `${activePath}/${from}`))
    setManifest(activePath, m)
    if (subtopic === from) setSubByProj((s) => ({ ...s, [activePath]: dir }))
  }
  const deleteSubtopic = async (name: string) => {
    if (!activePath) return
    await window.lime.pty.killPrefix(`${activePath}/${name}`)
    const m = await window.lime.projects.deleteSubtopic(activePath, name)
    setOpened((o) => o.filter((k) => k !== `${activePath}/${name}`))
    setManifest(activePath, m)
    if (subtopic === name) setSubByProj((s) => ({ ...s, [activePath]: m.subtopics[0] ?? null }))
  }
  const closeProject = (path: string) => {
    window.lime.pty.killPrefix(path)
    window.lime.context.unwatch(path)
    setOpened((o) => o.filter((k) => !k.startsWith(path + '/')))
    const next = projs.filter((p) => p.ref.path !== path)
    setProjs(next)
    if (activePath === path) setActivePath(next[0]?.ref.path ?? null)
  }

  const [sizes, setSizes] = useState<[number, number]>(() => { try { return JSON.parse(localStorage.getItem('lime.sizes') || '') } catch { return [220, 380] } })
  const drag = (which: 0 | 1) => (e: React.MouseEvent) => {
    e.preventDefault(); const startX = e.clientX; const start = sizes[which]
    const move = (ev: MouseEvent) => { const d = ev.clientX - startX; const next: [number, number] = [...sizes]; next[which] = Math.max(160, which === 0 ? start + d : start - d); setSizes(next); localStorage.setItem('lime.sizes', JSON.stringify(next)) }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const sessions = opened.map((k) => {
    const proj = projs.find((p) => k.startsWith(p.ref.path + '/'))
    return { key: k, model: proj?.manifest.settings?.sessionModel ?? '', label: k.slice((proj?.ref.path.length ?? 0) + 1) }
  }).filter((s) => projs.some((p) => s.key.startsWith(p.ref.path + '/')))

  if (!restored) return <div className="titlebar"><b>Cool-Lime</b></div>

  return (
    <>
      <div className="titlebar">
        <b>Cool-Lime</b>{active ? <span>{active.ref.name}{subtopic ? ` / ${subtopic}` : ''}</span> : <span>harness for Claude Code</span>}
        {active && <div className="tb-actions">
          <button className="ghost icon" title="Project settings" aria-label="Project settings" onClick={() => setSettingsOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
          </button>
        </div>}
      </div>
      {projs.length === 0 ? <StartScreen onOpen={open} /> : (
        <div className="layout" style={{ gridTemplateColumns: `${showLeft ? `${sizes[0]}px 4px` : `${STRIP}px`} ${showCenter ? '1fr' : `${STRIP}px`} ${showRight ? `4px ${sizes[1]}px` : `${STRIP}px`}` }}>
          {!showLeft && <Strip label="Sidebar" onClick={() => setShowLeft(true)} />}
          <div className={`pane ${showLeft ? '' : 'hidden'}`}>
            <Sidebar projs={projs} activePath={activePath} subtopic={subtopic} opened={opened}
              onSelectProject={(p) => { setActivePath(p); setExternalFile(null) }} onCloseProject={closeProject} onAddProject={() => setAdding(true)}
              onSelectSubtopic={(s) => { if (activePath) setSubByProj((m) => ({ ...m, [activePath]: s })); setExternalFile(null) }}
              onAdd={addSubtopic} onRename={renameSubtopic} onDelete={deleteSubtopic}
              ctxStatus={activePath ? ctxStatus[activePath] ?? { state: 'idle' } : { state: 'idle' }}
              onOpenFile={setExternalFile} onRegenerate={() => activePath && window.lime.context.regenerate(activePath)} onCollapse={() => setShowLeft(false)} />
          </div>
          {showLeft && <div className="gutter" onMouseDown={drag(0)} />}
          {!showCenter && <Strip label="Claude" onClick={() => setShowCenter(true)} />}
          <div className={`pane center ${showCenter ? '' : 'hidden'}`}>
            {sessions.length > 0 ? <>
              <TerminalPane sessions={sessions} activeKey={activeKey ?? ''} onCollapse={() => setShowCenter(false)} />
              {activePath && subtopic && <ShellPanel projectPath={activePath} subtopic={subtopic} open={shellOpen} onToggle={() => setShellOpen((o) => !o)} />}
            </> : <div className="empty">No subtopics yet.<br />Add one from the sidebar to start a Claude Code session.</div>}
          </div>
          {showRight && <div className="gutter" onMouseDown={drag(1)} />}
          {!showRight && <Strip label="Files" onClick={() => setShowRight(true)} />}
          <div className={`pane ${showRight ? '' : 'hidden'}`}>
            <FilePane root={activePath && subtopic ? `${activePath}/${subtopic}` : null} externalFile={externalFile} onCollapse={() => setShowRight(false)} />
          </div>
        </div>
      )}
      {adding && <div className="modal-bg" onClick={() => setAdding(false)}><div onClick={(e) => e.stopPropagation()}><StartScreen onOpen={open} onCancel={() => setAdding(false)} /></div></div>}
      {settingsOpen && active && <ProjectSettings project={active.ref} manifest={active.manifest} subtopic={subtopic} onClose={() => { setSettingsOpen(false); refresh(active.ref.path) }} />}
    </>
  )
}

function Strip({ label, onClick }: { label: string; onClick: () => void }) {
  return <div className="strip" title={`Show ${label}`} onClick={onClick}><span className="glyph">▸</span><span className="vlabel">{label}</span></div>
}
