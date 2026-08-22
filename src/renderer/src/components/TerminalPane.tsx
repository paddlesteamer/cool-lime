import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface Props { projectPath: string; opened: string[]; active: string; model: string }

function TermView({ id, cwd, visible, model }: { id: string; cwd: string; visible: boolean; model: string }) {
  const [exited, setExited] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const termRef = useRef<{ term: Terminal; fit: FitAddon } | null>(null)

  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace', fontSize: 13, cursorBlink: true, scrollback: 5000,
      allowProposedApi: true, macOptionIsMeta: true,
      theme: { background: '#0f120f', foreground: '#e6eadf', cursor: '#b5e853', selectionBackground: '#3a4a2a' }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(ref.current!)
    fit.fit()
    termRef.current = { term, fit }
    window.lime.pty.start(id, cwd, term.cols, term.rows, model)
    const offData = window.lime.pty.onData((sid: string, d: string) => { if (sid === id) term.write(d) })
    const offExit = window.lime.pty.onExit((sid: string, code: number) => { if (sid === id) setExited(code) })
    term.onData((d) => window.lime.pty.write(id, d))
    term.onResize(({ cols, rows }) => window.lime.pty.resize(id, cols, rows))
    const ro = new ResizeObserver(() => { if (ref.current?.offsetParent) fit.fit() })
    ro.observe(ref.current!)
    return () => { ro.disconnect(); offData(); offExit(); term.dispose() }
  }, [id])

  useEffect(() => { if (visible) setTimeout(() => { termRef.current?.fit.fit(); termRef.current?.term.focus() }, 0) }, [visible])

  const relaunch = async () => { const t = termRef.current!; t.term.clear(); setExited(null); await window.lime.pty.start(id, cwd, t.term.cols, t.term.rows, model); t.term.focus() }
  return (
    <div className={`term ${visible ? 'visible' : ''}`}>
      <div ref={ref} style={{ height: '100%' }} />
      {exited !== null && <div className="overlay"><div>Claude session ended (exit code {exited})<br /><button className="primary" onClick={relaunch}>Start new session</button></div></div>}
    </div>
  )
}

export default function TerminalPane({ projectPath, opened, active, model }: Props) {
  const restart = () => window.lime.pty.kill(`${projectPath}/${active}`) // exit overlay offers relaunch
  return (
    <>
      <div className="paneHead"><span>claude --dangerously-skip-permissions</span><span className="grow" /><code>{active}/</code><button className="ghost" onClick={restart}>Restart</button></div>
      <div className="terms">
        {opened.map((s) => <TermView key={s} id={`${projectPath}/${s}`} cwd={`${projectPath}/${s}`} visible={s === active} model={model} />)}
      </div>
    </>
  )
}
