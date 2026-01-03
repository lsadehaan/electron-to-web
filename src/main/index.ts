/**
 * Main process exports
 * Drop-in replacement for Electron's main process APIs
 */

export { ipcMain } from './ipc-main.js';
export { BrowserWindow } from './browser-window.js';
export type { BrowserWindowOptions } from './browser-window.js';
export type { IPCEvent, IPCHandler } from '../shared/types.js';
