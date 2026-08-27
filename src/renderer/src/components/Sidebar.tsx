import { useState } from 'react'
import type { ContextStatus } from '@shared/types'
import type { OpenProj } from '../App'

interface Props {
  projs: OpenProj[]; activePath: string | null; subtopic: string | null; opened: string[]
  onSelectProject: (path: string) => void; onCloseProject: (path: string) => void; onAddProject: () => void
  onSelectSubtopic: (s: string) => void; onAdd: (name: string) => Promise<void>; onRename: (from: string, to: string) => Promise<void>; onDelete: (s: string) => Promise<void>
  ctxStatus: ContextStatus; onOpenFile: (p: string) => void; onRegenerate: () => void; onCollapse: () => void
}

export default function Sidebar({ projs, activePath, subtopic, opened, onSelectProject, onCloseProject, onAddProject, onSelectSubtopic, onAdd, onRename, onDelete, ctxStatus, onOpenFile, onRegenerate, onCollapse }: Props) {
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState<{ s: string; x: number; y: number } | null>(null)
  const [err, setErr] = useState('')
  const active = projs.find((p) => p.ref.path === activePath) ?? null

  const commit = async () => {
    const v = draft.trim(); if (!v) { setAdding(false); setRenaming(null); return }
    try { if (renaming) await onRename(renaming, v); else await onAdd(v); setErr('') } catch (e: any) { setErr(e.message.replace(/^.*Error: /, '')) }
    setAdding(false); setRenaming(null); setDraft('')
  }
  const input = (
    <input autoFocus className="inline" value={draft} placeholder="subtopic name" onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setRenaming(null); setDraft('') } }} onBlur={commit} />
  )

  return (
    <div className="sidebar" onClick={() => setMenu(null)}>
      <h3>Projects
        <span className="h3btns">
          <button className="ghost" title="Open or create a project" onClick={onAddProject}>+</button>
          <button className="ghost icon" title="Collapse pane" aria-label="Collapse pane" onClick={onCollapse}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg></button>
        </span>
      </h3>
      {projs.map((p) => (
        <div key={p.ref.path} className={`item ${p.ref.path === activePath ? 'active' : ''}`} title={p.ref.path} onClick={() => onSelectProject(p.ref.path)}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.ref.name}</span>
          <span className="x" title="Close project" onClick={(e) => { e.stopPropagation(); onCloseProject(p.ref.path) }}>×</span>
        </div>
      ))}

      {active && <>
        <h3>Subtopics <button className="ghost" title="Add subtopic" onClick={() => { setAdding(true); setDraft('') }}>+</button></h3>
        {active.manifest.subtopics.map((s) => renaming === s ? <div key={s} className="item">{input}</div> : (
          <div key={s} className={`item ${s === subtopic ? 'active' : ''}`} onClick={() => onSelectSubtopic(s)}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ s, x: e.clientX, y: e.clientY }) }}>
            <span className={`dot ${opened.includes(`${active.ref.path}/${s}`) ? 'live' : ''}`} />{s}
          </div>
        ))}
        {adding && <div className="item">{input}</div>}
        {err && <div className="err" style={{ padding: '0 12px' }}>{err}</div>}
        {active.manifest.subtopics.length === 0 && !adding && <div className="item" onClick={() => setAdding(true)}>+ add your first subtopic</div>}
        <div className="spacer" />
        <h3>Context <button className="ghost" title="Regenerate CONTEXT.md now" disabled={ctxStatus.state === 'running'} onClick={onRegenerate}>↻</button></h3>
        <div className="item" onClick={() => onOpenFile(`${active.ref.path}/CONTEXT.md`)}><span className={`dot ${ctxStatus.state === 'running' ? 'busy' : ctxStatus.state === 'error' ? 'err' : 'live'}`} />CONTEXT.md</div>
        <div className="item" onClick={() => window.lime.projects.revealInFinder(`${active.ref.path}/context`)}>context/ (sources)</div>
        <div className="status" title={ctxStatus.message}>{ctxStatus.state === 'running' ? '⏳ ' : ctxStatus.state === 'error' ? '⚠ ' : ''}{ctxStatus.message ?? (active.manifest.settings?.autoContext === false ? 'auto-update off' : ctxStatus.lastRun ? 'up to date' : 'watching for changes')}</div>

        {menu && (
          <div className="menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            <div onClick={() => { setRenaming(menu.s); setDraft(menu.s); setMenu(null) }}>Rename</div>
            <div onClick={() => { window.lime.projects.revealInFinder(`${active.ref.path}/${menu.s}`); setMenu(null) }}>Reveal in Finder</div>
            <div className="danger" onClick={() => { if (confirm(`Move subtopic "${menu.s}" to Trash?`)) onDelete(menu.s); setMenu(null) }}>Delete…</div>
          </div>
        )}
      </>}
      {!active && <div className="spacer" />}
    </div>
  )
}
