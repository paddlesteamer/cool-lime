import XTerm from './XTerm'

interface Props { projectPath: string; opened: string[]; active: string; model: string }

export default function TerminalPane({ projectPath, opened, active, model }: Props) {
  const restart = () => window.lime.pty.kill(`${projectPath}/${active}`) // exit overlay offers relaunch
  return (
    <>
      <div className="paneHead"><span>claude --dangerously-skip-permissions</span><span className="grow" /><code>{active}/</code><button className="ghost" onClick={restart}>Restart</button></div>
      <div className="terms">
        {opened.map((s) => <XTerm key={s} id={`${projectPath}/${s}`} cwd={`${projectPath}/${s}`} visible={s === active} kind="claude" model={model} />)}
      </div>
    </>
  )
}
