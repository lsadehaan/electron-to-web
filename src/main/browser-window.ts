/**
 * BrowserWindow - Minimal shim for Electron's BrowserWindow
 * Only provides webContents.send() for IPC notifications
 */

import { ipcMain } from './ipc-main.js';

export interface BrowserWindowOptions {
  width?: number;
  height?: number;
  webPreferences?: {
    nodeIntegration?: boolean;
    contextIsolation?: boolean;
    preload?: string;
  };
  [key: string]: any;
}

export class BrowserWindow {
  /**
   * Web contents shim
   * Provides send() and sendTo() for IPC notifications
   */
  webContents = {
    /**
     * Send notification to all connected clients (Electron-compatible API)
     * @param channel - IPC channel name
     * @param args - Arguments to send
     */
    send: (channel: string, ...args: any[]): void => {
      ipcMain.broadcast(channel, ...args);
    },

    /**
     * Send notification to specific client (Electron-compatible API)
     * @param webContentsId - Client ID
     * @param channel - IPC channel name
     * @param args - Arguments to send
     */
    sendTo: (webContentsId: string, channel: string, ...args: any[]): void => {
      ipcMain.sendTo(webContentsId, channel, ...args);
    },
  };

  constructor(options?: BrowserWindowOptions) {
    // Options are ignored in web mode
    // This is just a shim for API compatibility
    if (options) {
      console.log('[BrowserWindow] Options ignored in web mode:', Object.keys(options));
    }
  }

  // Stub methods for API compatibility (no-ops in web mode)
  loadURL(_url: string): Promise<void> {
    return Promise.resolve();
  }

  loadFile(_path: string): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    // No-op
  }

  minimize(): void {
    // No-op
  }

  maximize(): void {
    // No-op
  }

  unmaximize(): void {
    // No-op
  }

  isMaximized(): boolean {
    return false;
  }

  setFullScreen(_flag: boolean): void {
    // No-op
  }

  isFullScreen(): boolean {
    return false;
  }

  setTitle(_title: string): void {
    // No-op (use document.title in renderer)
  }

  on(_event: string, _listener: (...args: any[]) => void): this {
    return this;
  }

  once(_event: string, _listener: (...args: any[]) => void): this {
    return this;
  }

  removeListener(_event: string, _listener: (...args: any[]) => void): this {
    return this;
  }

  isDestroyed(): boolean {
    return false;
  }
}
