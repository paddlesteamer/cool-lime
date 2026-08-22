import type { LimeApi } from '../../preload/index'
declare global { interface Window { lime: LimeApi } }
declare module '*.css' {}
declare module '@xterm/xterm/css/xterm.css' {}
export {}
