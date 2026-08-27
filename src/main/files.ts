import { promises as fs } from 'fs'
import { join, relative } from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import type { Sender } from './pty'
import type { FileNode, FsEvent } from '@shared/types'

const IGNORE = new Set(['node_modules', '.git', '.DS_Store', '.trash'])

export async function readTree(root: string, depth = 6): Promise<FileNode[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  const nodes: FileNode[] = []
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue
    const path = join(root, e.name)
    const node: FileNode = { name: e.name, path, isDir: e.isDirectory() }
    if (node.isDir && depth > 0) node.children = await readTree(path, depth - 1)
    nodes.push(node)
  }
  return nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
}

export const readFile = (p: string) => fs.readFile(p, 'utf8')
export const writeFile = (p: string, c: string) => fs.writeFile(p, c)

let watcher: FSWatcher | null = null
export function watchDir(root: string, send: Sender) {
  watcher?.close()
  watcher = chokidar.watch([root, join(root, '..', 'CONTEXT.md')], {
    ignored: (p) => p.split('/').some((s) => IGNORE.has(s)), ignoreInitial: true, persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  })
  const emit = (type: FsEvent['type']) => (path: string) => send('fs:event', { type, path } satisfies FsEvent)
  watcher.on('add', emit('add')).on('change', emit('change')).on('unlink', emit('unlink')).on('addDir', emit('addDir')).on('unlinkDir', emit('unlinkDir'))
}
export const unwatch = () => { watcher?.close(); watcher = null }
export const rel = relative
