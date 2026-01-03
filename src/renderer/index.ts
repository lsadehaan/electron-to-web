/**
 * Renderer process exports
 * Drop-in replacement for Electron's renderer process APIs
 */

export { ipcRenderer } from './ipc-renderer.js';
export type { IPCEvent } from '../shared/types.js';

// Native API shims
export { clipboard } from './clipboard.js';
export { dialog } from './dialog.js';
export type { FileFilter, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions, OpenDialogReturnValue, SaveDialogReturnValue, MessageBoxReturnValue } from './dialog.js';
export { Notification } from './notification.js';
export type { NotificationOptions } from './notification.js';
export { shell } from './shell.js';
export { screen } from './screen.js';
export type { Display, Point } from './screen.js';
