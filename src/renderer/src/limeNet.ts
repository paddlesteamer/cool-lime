// Network implementation of the preload `window.lime` API — used when the app runs in a browser
// against the Cool-Lime server instead of inside Electron.

export function installNetLime() {
  const token = new URLSearchParams(location.search).get('token') ?? ''
  const listeners = new Map<string, Set<(...a: any[]) => void>>()
  let ws: WebSocket | null = null
  let queue: string[] = []

  const connect = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`)
    ws.onopen = () => { const q = queue; queue = []; q.forEach((m) => ws!.send(m)) }
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); listeners.get(m.t)?.forEach((cb) => cb(...m.a)) }
    ws.onclose = () => setTimeout(connect, 1500)
  }
  connect()

  const send = (obj: object) => { const s = JSON.stringify(obj); ws && ws.readyState === WebSocket.OPEN ? ws.send(s) : queue.push(s) }
  const on = (ch: string) => (cb: (...a: any[]) => void) => {
    if (!listeners.has(ch)) listeners.set(ch, new Set())
    listeners.get(ch)!.add(cb)
    return () => { listeners.get(ch)!.delete(cb) }
  }
  const rpc = (method: string) => async (...args: any[]) => {
    const r = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { 'x-lime-token': token } : {}) },
      body: JSON.stringify({ method, args })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || r.statusText)
    return j.result
  }

  const pickAndUpload = (projectPath: string) => new Promise<string[]>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'; input.multiple = true
    input.accept = '.md,.txt,.pdf,.docx,.doc,.csv,.json'
    input.onchange = async () => {
      const names: string[] = []
      for (const f of Array.from(input.files ?? [])) {
        const r = await fetch(`/api/upload?project=${encodeURIComponent(projectPath)}&name=${encodeURIComponent(f.name)}`,
          { method: 'PUT', headers: token ? { 'x-lime-token': token } : {}, body: f })
        if (r.ok) names.push(f.name)
      }
      resolve(names)
    }
    input.oncancel = () => resolve([])
    input.click()
  })

  const api = {
    projects: {
      list: rpc('projects.list'), create: rpc('projects.create'), open: rpc('projects.open'),
      manifest: rpc('projects.manifest'), addSubtopic: rpc('projects.addSubtopic'),
      renameSubtopic: rpc('projects.renameSubtopic'), renameProject: rpc('projects.renameProject'), deleteSubtopic: rpc('projects.deleteSubtopic'), updateSettings: rpc('projects.updateSettings'),
      addContextText: rpc('projects.addContextText'), importContextFiles: pickAndUpload,
      revealInFinder: async () => console.warn('[cool-lime] reveal in Finder is unavailable in the browser')
    },
    context: { watch: rpc('context.watch'), unwatch: rpc('context.unwatch'), regenerate: rpc('context.regenerate'), status: rpc('context.status'), onStatus: on('context:status') },
    mcp: { setProject: rpc('mcp.setProject'), setSubtopic: rpc('mcp.setSubtopic'), remove: rpc('mcp.remove') },
    pty: {
      start: rpc('pty.start'), kill: rpc('pty.kill'), killPrefix: rpc('pty.killPrefix'), has: rpc('pty.has'),
      write: (id: string, data: string) => send({ t: 'pty:write', id, data }),
      resize: (id: string, cols: number, rows: number) => send({ t: 'pty:resize', id, cols, rows }),
      onData: on('pty:data'), onExit: on('pty:exit')
    },
    fs: { tree: rpc('fs.tree'), read: rpc('fs.read'), write: rpc('fs.write'), watch: rpc('fs.watch'), unwatch: rpc('fs.unwatch'), onEvent: on('fs:event') }
  }
  ;(window as any).lime = api
}
