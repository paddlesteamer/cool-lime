import { contextBridge, ipcRenderer } from 'electron'

const invoke = (ch: string) => (...a: any[]) => ipcRenderer.invoke(ch, ...a)
const on = (ch: string) => (cb: (...a: any[]) => void) => {
  const l = (_e: any, ...a: any[]) => cb(...a)
  ipcRenderer.on(ch, l)
  return () => { ipcRenderer.removeListener(ch, l) }
}

const api = {
  projects: {
    list: invoke('projects:list'), create: invoke('projects:create'), open: invoke('projects:open'),
    manifest: invoke('projects:manifest'), addSubtopic: invoke('projects:addSubtopic'),
    renameSubtopic: invoke('projects:renameSubtopic'), deleteSubtopic: invoke('projects:deleteSubtopic'), updateSettings: invoke('projects:updateSettings'),
    addContextText: invoke('projects:addContextText'), importContextFiles: invoke('projects:importContextFiles'),
    revealInFinder: invoke('projects:revealInFinder')
  },
  context: { watch: invoke('context:watch'), unwatch: invoke('context:unwatch'), regenerate: invoke('context:regenerate'), status: invoke('context:status'), onStatus: on('context:status') },
  mcp: { setProject: invoke('mcp:setProject'), setSubtopic: invoke('mcp:setSubtopic'), remove: invoke('mcp:remove') },
  pty: {
    start: invoke('pty:start'), kill: invoke('pty:kill'), killPrefix: invoke('pty:killPrefix'), has: invoke('pty:has'),
    write: (id: string, d: string) => ipcRenderer.send('pty:write', id, d),
    resize: (id: string, c: number, r: number) => ipcRenderer.send('pty:resize', id, c, r),
    onData: on('pty:data'), onExit: on('pty:exit')
  },
  fs: { tree: invoke('fs:tree'), read: invoke('fs:read'), write: invoke('fs:write'), watch: invoke('fs:watch'), unwatch: invoke('fs:unwatch'), onEvent: on('fs:event') }
}
contextBridge.exposeInMainWorld('lime', api)
export type LimeApi = typeof api
