import { homedir } from 'os'
import { join } from 'path'

export const COOL_LIME_HOME = join(homedir(), '.cool-lime')
export const PROJECTS_ROOT = join(homedir(), 'CoolLime')
export const REGISTRY_FILE = join(COOL_LIME_HOME, 'projects.json')
export const MANIFEST = 'cool-lime.json'
export const CONTEXT_DIR = 'context'
export const CONTEXT_FILE = 'CONTEXT.md'
export const RESERVED_DIRS = new Set([CONTEXT_DIR, '.git', '.claude'])
