/**
 * Shell API shim
 * Maps Electron's shell API to web APIs and server-side operations
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/shell
 */

import { ipcRenderer } from './ipc-renderer.js';

export class Shell {
  /**
   * Open external URL in browser
   * @param url - URL to open
   */
  async openExternal(url: string): Promise<void> {
    // In web, just use window.open
    window.open(url, '_blank');
  }

  /**
   * Open file in desktop's default application
   * Requires server-side handler with security enabled
   * @param path - File path to open
   */
  async openPath(path: string): Promise<string> {
    try {
      await ipcRenderer.invoke('shell:openPath', path);
      return ''; // Electron returns empty string on success
    } catch (error) {
      return (error as Error).message;
    }
  }

  /**
   * Show file in file manager
   * Requires server-side handler with security enabled
   * @param fullPath - Full path to file
   */
  async showItemInFolder(fullPath: string): Promise<void> {
    try {
      await ipcRenderer.invoke('shell:showItemInFolder', fullPath);
    } catch (error) {
      console.error('[electron-to-web] Failed to show item in folder:', error);
      throw error;
    }
  }

  /**
   * Move file to trash
   * Requires server-side handler with security enabled
   * @param path - Path to file
   */
  async trashItem(path: string): Promise<void> {
    try {
      await ipcRenderer.invoke('shell:trashItem', path);
    } catch (error) {
      console.error('[electron-to-web] Failed to trash item:', error);
      throw error;
    }
  }

  /**
   * Play beep sound
   * In web, can only use Audio API or system bell
   */
  beep(): void {
    // Try to play a simple beep sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('[electron-to-web] Failed to play beep:', error);
    }
  }

  /**
   * Write shortcut link (Windows only)
   * Not supported in web - requires server-side
   */
  async writeShortcutLink(_shortcutPath: string, _operation: 'create' | 'update' | 'replace', _options: any): Promise<boolean> {
    console.warn('[electron-to-web] writeShortcutLink not supported in web environment');
    return false;
  }

  /**
   * Read shortcut link (Windows only)
   * Not supported in web - requires server-side
   */
  readShortcutLink(_shortcutPath: string): any {
    console.warn('[electron-to-web] readShortcutLink not supported in web environment');
    return null;
  }
}

// Singleton instance
export const shell = new Shell();
