import { useCallback, useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import type { FileNode, FsEvent } from '@shared/types'

const lang = (p: string) => p.endsWith('.md') ? [markdown()] : p.endsWith('.json') ? [json()] : /\.(js|ts|jsx|tsx)$/.test(p) ? [javascript({ typescript: true, jsx: true })] : []

function Tree({ nodes, depth, active, onOpen }: { nodes: FileNode[]; depth: number; active: string | null; onOpen: (p: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  return <>{nodes.map((n) => (
    <div key={n.path}>
      <div className={`tnode ${n.isDir ? 'dir' : ''} ${n.path === active ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => n.isDir ? setOpen((o) => ({ ...o, [n.path]: !o[n.path] })) : onOpen(n.path)}>
        <span>{n.isDir ? (open[n.path] ? '▾' : '▸') : '·'}</span>{n.name}
      </div>
      {n.isDir && open[n.path] && n.children && <Tree nodes={n.children} depth={depth + 1} active={active} onOpen={onOpen} />}
    </div>))}</>
}

export default function FilePane({ root }: { root: string | null }) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [file, setFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [changedOnDisk, setChangedOnDisk] = useState(false)
  const dirtyRef = useRef(false); dirtyRef.current = dirty
  const fileRef = useRef<string | null>(null); fileRef.current = file

  const reload = useCallback(async () => { if (root) setTree(await window.lime.fs.tree(root)) }, [root])
  const loadFile = useCallback(async (p: string) => { setContent(await window.lime.fs.read(p)); setFile(p); setDirty(false); setChangedOnDisk(false) }, [])

  useEffect(() => {
    if (!root) return
    setFile(null); setContent(''); setDirty(false)
    reload(); window.lime.fs.watch(root)
    // Auto-open CLAUDE.md for orientation
    loadFile(`${root}/CLAUDE.md`).catch(() => {})
    const off = window.lime.fs.onEvent((ev: FsEvent) => {
      reload()
      if (ev.path === fileRef.current) {
        if (ev.type === 'change' && !dirtyRef.current) loadFile(ev.path)
        else if (ev.type === 'change') setChangedOnDisk(true)
      }
    })
    return off
  }, [root])

  const save = async () => { if (file) { await window.lime.fs.write(file, content); setDirty(false); setChangedOnDisk(false) } }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })

  if (!root) return <div className="right"><div className="empty">Select a subtopic</div></div>
  return (
    <div className="right">
      <div className="paneHead"><span>Files</span><span className="grow" /><button className="ghost" onClick={reload}>↻</button><button className="ghost" onClick={() => window.lime.projects.revealInFinder(root)}>Finder</button></div>
      <div className="tree"><Tree nodes={tree} depth={0} active={file} onOpen={loadFile} /></div>
      <div className="paneHead"><code>{file ? file.slice(root.length + 1) : '—'}</code>{dirty && <span> •</span>}<span className="grow" /><button className="ghost" disabled={!dirty} onClick={save}>Save ⌘S</button></div>
      {changedOnDisk && <div className="banner">File changed on disk. <button onClick={() => loadFile(file!)}>Reload</button><button onClick={save}>Keep mine</button></div>}
      <div className="editor">{file && <CodeMirror value={content} theme="dark" extensions={lang(file)} onChange={(v) => { setContent(v); setDirty(true) }} basicSetup={{ lineNumbers: true, foldGutter: false }} />}</div>
    </div>
  )
}
