import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface Props { id: string; cwd: string; visible: boolean; kind: 'claude' | 'shell'; model?: string; onExit?: (code: number) => void }

/** One xterm bound to one main-process pty session. Survives tab switches (display:none) and refits when shown. */
export default function XTerm({ id, cwd, visible, kind, model = '', onExit }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const termRef = useRef<{ term: Terminal; fit: FitAddon } | null>(null)
  const [exited, setExited] = useState<number | null>(null)

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
    window.lime.pty.start(id, cwd, term.cols, term.rows, model, kind)
    const offData = window.lime.pty.onData((sid: string, d: string) => { if (sid === id) term.write(d) })
    const offExit = window.lime.pty.onExit((sid: string, code: number) => { if (sid === id) { setExited(code); onExit?.(code) } })
    term.onData((d) => window.lime.pty.write(id, d))
    term.onResize(({ cols, rows }) => window.lime.pty.resize(id, cols, rows))
    const ro = new ResizeObserver(() => { if (ref.current?.offsetParent) fit.fit() })
    ro.observe(ref.current!)
    return () => { ro.disconnect(); offData(); offExit(); term.dispose() }
  }, [id])

  useEffect(() => { if (visible) setTimeout(() => { termRef.current?.fit.fit(); termRef.current?.term.focus() }, 0) }, [visible])

  const relaunch = async () => { const t = termRef.current!; t.term.clear(); setExited(null); await window.lime.pty.start(id, cwd, t.term.cols, t.term.rows, model, kind); t.term.focus() }
  return (
    <div className={`term ${visible ? 'visible' : ''}`}>
      <div ref={ref} style={{ height: '100%' }} />
      {exited !== null && kind === 'claude' && <div className="overlay"><div>Claude session ended (exit code {exited})<br /><button className="primary" onClick={relaunch}>Start new session</button></div></div>}
    </div>
  )
}
