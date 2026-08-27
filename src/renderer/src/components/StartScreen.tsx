import { useEffect, useState } from 'react'
import type { ProjectRef } from '@shared/types'

export default function StartScreen({ onOpen, onCancel }: { onOpen: (path: string) => void; onCancel?: () => void }) {
  const [recent, setRecent] = useState<ProjectRef[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [context, setContext] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { window.lime.projects.list().then(setRecent) }, [])

  const create = async () => {
    try { const ref = await window.lime.projects.create(name, context); onOpen(ref.path) } catch (e: any) { setErr(e.message) }
  }

  const card = (
    <div className="card">
      <div className="row"><h1 style={{ flex: 1 }}><span>Cool</span>-Lime</h1>{onCancel && <button className="ghost" onClick={onCancel}>✕</button>}</div>
      <p className="sub">Projects with shared context, each subtopic a Claude Code session.</p>
      {!creating ? (<>
        {recent.length > 0 && <ul className="recent">{recent.map((r) => (
          <li key={r.path} onClick={() => onOpen(r.path)}><span>{r.name}</span><small>{new Date(r.lastOpened).toLocaleString()}</small></li>))}</ul>}
        {recent.length === 0 && <p className="sub">No projects yet.</p>}
        <div className="row end"><button className="primary" onClick={() => setCreating(true)}>New project</button></div>
      </>) : (<>
        <label>Project name</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing site relaunch" />
        <label>Initial context (optional — markdown; you can add PDF/Word/CSV files later in Project settings)</label>
        <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="What is this project about? Goals, constraints, links…" />
        {err && <div className="err">{err}</div>}
        <div className="row end"><button onClick={() => setCreating(false)}>Back</button><button className="primary" disabled={!name.trim()} onClick={create}>Create</button></div>
      </>)}
    </div>
  )
  return onCancel ? card : <div className="start">{card}</div>
}
