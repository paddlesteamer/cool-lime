export interface McpSpec {
  name: string
  transport: 'stdio' | 'http' | 'sse'
  command?: string // stdio: command + args
  args?: string[]
  url?: string // http/sse
  env?: Record<string, string>
}

export interface ProjectManifest {
  name: string
  created: string
  subtopics: string[]
  mcps: { project: McpSpec[]; subtopic: Record<string, McpSpec[]> }
  settings?: ProjectSettings
}

export interface ProjectSettings {
  autoContext: boolean // watch & regenerate CONTEXT.md automatically
  curatorModel: string // '' = default
  sessionModel: string // '' = default, passed as --model to interactive sessions
}
export const DEFAULT_SETTINGS: ProjectSettings = { autoContext: true, curatorModel: '', sessionModel: '' }

export interface ProjectRef {
  name: string
  path: string
  lastOpened: string
}

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export interface FsEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

export interface ContextStatus {
  state: 'idle' | 'running' | 'error'
  message?: string
  lastRun?: string
}
