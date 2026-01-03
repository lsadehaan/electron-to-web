/**
 * Renderer process exports
 * Drop-in replacement for Electron's renderer process APIs
 */

export { ipcRenderer } from './ipc-renderer.js';
export type { IPCEvent } from '../shared/types.js';
