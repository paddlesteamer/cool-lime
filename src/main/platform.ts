import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'

/** Moves a path to the OS trash when Electron is available, else to a sibling .trash/ folder. */
export async function trashItem(p: string): Promise<void> {
  try {
    const electron = require('electron')
    if (electron && typeof electron === 'object' && electron.shell?.trashItem) { await electron.shell.trashItem(p); return }
  } catch {}
  const trash = join(dirname(p), '.trash')
  await fs.mkdir(trash, { recursive: true })
  await fs.rename(p, join(trash, `${basename(p)}-${Date.now()}`))
}
