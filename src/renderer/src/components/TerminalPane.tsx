import XTerm from './XTerm'

export interface SessionDesc { key: string; model: string; label: string }
interface Props { sessions: SessionDesc[]; activeKey: string; onCollapse: () => void }

export default function TerminalPane({ sessions, activeKey, onCollapse }: Props) {
  const restart = () => activeKey && window.lime.pty.kill(activeKey) // exit overlay offers relaunch
  const label = sessions.find((s) => s.key === activeKey)?.label ?? '—'
  return (
    <>
      <div className="paneHead"><span>claude --dangerously-skip-permissions (resumes last session if one exists)</span><span className="grow" /><code>{label}/</code><button className="ghost" onClick={restart}>Restart</button><button className="ghost icon" title="Collapse pane" aria-label="Collapse pane" onClick={onCollapse}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg></button></div>
      <div className="terms">
        {sessions.map((s) => <XTerm key={s.key} id={s.key} cwd={s.key} visible={s.key === activeKey} kind="claude" model={s.model} />)}
      </div>
    </>
  )
}
