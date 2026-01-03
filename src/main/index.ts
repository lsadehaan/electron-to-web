/**
 * Main process exports
 * Drop-in replacement for Electron's main process APIs
 */

export { ipcMain } from './ipc-main.js';
export { BrowserWindow } from './browser-window.js';
export type { BrowserWindowOptions } from './browser-window.js';
export type { IPCEvent, IPCHandler } from '../shared/types.js';

// App API
export { app } from './app.js';

// SafeStorage API
export { safeStorage } from './safe-storage.js';

// Shell API
export { shell } from './shell.js';

// Dialog API
export { dialog } from './dialog.js';

// Clipboard API
export { clipboard } from './clipboard.js';

// Notification API
export { Notification } from './notification.js';

// Session API
export { session } from './session.js';

// Native API handlers (server-side)
export { registerNativeHandlers, unregisterNativeHandlers } from './native-handlers.js';
export type { SecurityConfig, SecurityError } from '../shared/security-config.js';
export { DEFAULT_SECURITY_CONFIG, TRUSTED_SECURITY_CONFIG, mergeSecurityConfig } from '../shared/security-config.js';
