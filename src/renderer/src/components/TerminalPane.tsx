import XTerm from './XTerm'

interface Props { projectPath: string; opened: string[]; active: string; model: string; onCollapse: () => void }

export default function TerminalPane({ projectPath, opened, active, model, onCollapse }: Props) {
  const restart = () => window.lime.pty.kill(`${projectPath}/${active}`) // exit overlay offers relaunch
  return (
    <>
      <div className="paneHead"><span>claude --dangerously-skip-permissions (resumes last session if one exists)</span><span className="grow" /><code>{active}/</code><button className="ghost" onClick={restart}>Restart</button><button className="ghost icon" title="Collapse pane" aria-label="Collapse pane" onClick={onCollapse}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg></button></div>
      <div className="terms">
        {opened.map((s) => <XTerm key={s} id={`${projectPath}/${s}`} cwd={`${projectPath}/${s}`} visible={s === active} kind="claude" model={model} />)}
      </div>
    </>
  )
}
