import { useEffect, useState } from 'react'
import XTerm from './XTerm'

interface Props { projectPath: string; subtopic: string; open: boolean; onToggle: () => void }

// Shell tabs are kept per subtopic so switching subtopics doesn't lose them.
const tabsBySub = new Map<string, { ids: string[]; active: string | null; next: number }>()

export default function ShellPanel({ projectPath, subtopic, open, onToggle }: Props) {
  const key = `${projectPath}/${subtopic}`
  const [, bump] = useState(0)
  const state = tabsBySub.get(key) ?? { ids: [], active: null, next: 1 }
  tabsBySub.set(key, state)
  const rerender = () => bump((n) => n + 1)

  const add = () => { const id = `${key}#sh${state.next++}`; state.ids.push(id); state.active = id; rerender() }
  const close = (id: string) => { window.lime.pty.kill(id); state.ids = state.ids.filter((x) => x !== id); if (state.active === id) state.active = state.ids[state.ids.length - 1] ?? null; rerender() }

  useEffect(() => { if (open && state.ids.length === 0) add() }, [open, key])

  return (
    <div className={`shell ${open ? 'open' : ''}`}>
      <div className="paneHead">
        <button className="ghost" onClick={onToggle} title="Toggle terminal (⌘J)">{open ? '▾' : '▸'} Terminal</button>
        {open && state.ids.map((id, i) => (
          <span key={id} className={`tab ${id === state.active ? 'active' : ''}`} onClick={() => { state.active = id; rerender() }}>
            zsh {i + 1}<span className="x" onClick={(e) => { e.stopPropagation(); close(id) }}>×</span>
          </span>))}
        {open && <button className="ghost" onClick={add} title="New terminal">+</button>}
        <span className="grow" /><code>{subtopic}/</code>
      </div>
      {open && <div className="terms">
        {state.ids.map((id) => <XTerm key={id} id={id} cwd={key} visible={id === state.active} kind="shell" onExit={() => close(id)} />)}
      </div>}
    </div>
  )
}
