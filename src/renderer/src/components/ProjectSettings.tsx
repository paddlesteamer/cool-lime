import { useState } from 'react'
import type { McpSpec, ProjectManifest, ProjectRef } from '@shared/types'

interface Props { project: ProjectRef; manifest: ProjectManifest; subtopic: string | null; onClose: () => void }

function McpForm({ onAdd }: { onAdd: (s: McpSpec) => void }) {
  const [name, setName] = useState(''); const [transport, setTransport] = useState<McpSpec['transport']>('stdio')
  const [cmd, setCmd] = useState(''); const [url, setUrl] = useState(''); const [env, setEnv] = useState('')
  const submit = () => {
    const [command, ...args] = cmd.trim().split(/\s+/)
    const envObj = Object.fromEntries(env.split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
    onAdd(transport === 'stdio' ? { name, transport, command, args, env: envObj } : { name, transport, url, env: envObj })
    setName(''); setCmd(''); setUrl(''); setEnv('')
  }
  return (
    <div>
      <div className="row"><div style={{ flex: 1 }}><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="github" /></div>
        <div><label>Transport</label><select value={transport} onChange={(e) => setTransport(e.target.value as any)}><option value="stdio">stdio</option><option value="http">http</option><option value="sse">sse</option></select></div></div>
      {transport === 'stdio' ? <><label>Command (with args)</label><input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="npx -y @modelcontextprotocol/server-github" /></>
        : <><label>URL</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/mcp" /></>}
      <label>Env (KEY=value per line, optional)</label><textarea style={{ minHeight: 50 }} value={env} onChange={(e) => setEnv(e.target.value)} />
      <div className="row end"><button className="primary" disabled={!name || (transport === 'stdio' ? !cmd : !url)} onClick={submit}>Add</button></div>
    </div>
  )
}

export default function ProjectSettings({ project, manifest: initial, subtopic, onClose }: Props) {
  const [manifest, setManifest] = useState(initial)
  const [tab, setTab] = useState<'context' | 'mcp' | 'general'>('context')
  const [scope, setScope] = useState<'project' | 'subtopic'>('project')
  const [title, setTitle] = useState(''); const [text, setText] = useState('')
  const [log, setLog] = useState(''); const [busy, setBusy] = useState(false)

  const refresh = async () => setManifest(await window.lime.projects.manifest(project.path))
  const addText = async () => { await window.lime.projects.addContextText(project.path, title || 'note', text); setTitle(''); setText(''); setLog(`Saved to context/`) }
  const importFiles = async () => { const f = await window.lime.projects.importContextFiles(project.path); setLog(f.length ? `Imported:\n${f.join('\n')}` : 'Nothing imported') }

  const specs = scope === 'project' ? manifest.mcps.project : manifest.mcps.subtopic[subtopic ?? ''] ?? []
  const addMcp = async (s: McpSpec) => {
    setBusy(true)
    const next = [...specs.filter((x) => x.name !== s.name), s]
    const out = scope === 'project' ? await window.lime.mcp.setProject(project.path, next) : await window.lime.mcp.setSubtopic(project.path, subtopic!, next)
    setLog(out || '(no output)'); await refresh(); setBusy(false)
  }
  const removeMcp = async (name: string) => { setBusy(true); setLog(await window.lime.mcp.remove(project.path, scope === 'project' ? null : subtopic, name)); await refresh(); setBusy(false) }

  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="row"><h2 style={{ flex: 1 }}>{project.name} — settings</h2>
        <button className={tab === 'context' ? 'primary' : ''} onClick={() => setTab('context')}>Context</button>
        <button className={tab === 'mcp' ? 'primary' : ''} onClick={() => setTab('mcp')}>MCP servers</button>
        <button className={tab === 'general' ? 'primary' : ''} onClick={() => setTab('general')}>General</button>
        <button className="ghost" onClick={onClose}>✕</button></div>

      {tab === 'context' && (<>
        <p style={{ color: 'var(--fg2)' }}>Sources live in <code>context/</code>. Cool-Lime distills them into <code>CONTEXT.md</code>, which every subtopic imports.</p>
        <div className="row"><button onClick={importFiles}>Import files (md / pdf / docx / csv …)</button></div>
        <label>Or add text</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title (becomes file name)" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="markdown…" />
        <div className="row end"><button className="primary" disabled={!text.trim()} onClick={addText}>Save note</button></div>
      </>)}

      {tab === 'mcp' && (<>
        <div className="row"><label style={{ margin: 0 }}>Scope</label>
          <select style={{ width: 'auto' }} value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="project">Project-wide (all subtopics)</option>
            <option value="subtopic" disabled={!subtopic}>Subtopic: {subtopic ?? '—'}</option></select></div>
        <ul className="mcpList">{specs.map((s) => <li key={s.name}><span>{s.name} <small style={{ color: 'var(--fg2)' }}>{s.transport} {s.command ? [s.command, ...(s.args ?? [])].join(' ') : s.url}</small></span><button className="ghost" disabled={busy} onClick={() => removeMcp(s.name)}>remove</button></li>)}
          {specs.length === 0 && <li style={{ color: 'var(--fg2)' }}>none</li>}</ul>
        <McpForm onAdd={addMcp} />
        <p style={{ color: 'var(--fg2)', fontSize: 12 }}>Applied with <code>claude mcp add -s project</code> inside each subtopic folder. Restart the subtopic's session to pick up changes.</p>
      </>)}
      {tab === 'general' && (<>
        <label><input type="checkbox" style={{ width: 'auto', marginRight: 8 }} checked={manifest.settings?.autoContext !== false}
          onChange={async (e) => setManifest(await window.lime.projects.updateSettings(project.path, { autoContext: e.target.checked }))} />
          Auto-update CONTEXT.md when context/ or subtopic notes change</label>
        <label>Curator model (headless agent that writes CONTEXT.md; blank = default)</label>
        <input defaultValue={manifest.settings?.curatorModel ?? ''} placeholder="e.g. sonnet, opus, haiku"
          onBlur={async (e) => setManifest(await window.lime.projects.updateSettings(project.path, { curatorModel: e.target.value.trim() }))} />
        <label>Session model (passed as --model to each subtopic's Claude Code; blank = default, applies to new sessions)</label>
        <input defaultValue={manifest.settings?.sessionModel ?? ''} placeholder="e.g. opus"
          onBlur={async (e) => setManifest(await window.lime.projects.updateSettings(project.path, { sessionModel: e.target.value.trim() }))} />
        <label>Project folder</label>
        <div className="row"><code style={{ flex: 1, fontSize: 12 }}>{project.path}</code></div>
      </>)}
      {log && <pre className="log">{log}</pre>}
    </div></div>
  )
}
