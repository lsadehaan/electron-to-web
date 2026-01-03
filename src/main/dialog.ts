/**
 * Dialog API shim
 * Maps Electron's dialog API to Node.js/console equivalents
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/dialog
 *
 * Note: Full dialog functionality requires a GUI. This is a minimal shim
 * for server-side code that may import dialog but not necessarily use it.
 */

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'showHiddenFiles' | 'createDirectory' | 'showOverwriteConfirmation'>;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
}

export class Dialog {
  /**
   * Show open dialog (not fully supported in server context)
   */
  async showOpenDialog(options?: OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }> {
    console.warn('[electron-to-web] showOpenDialog not supported in server context');
    console.log('[electron-to-web] Dialog options:', options);
    return { canceled: true, filePaths: [] };
  }

  /**
   * Show save dialog (not fully supported in server context)
   */
  async showSaveDialog(options?: SaveDialogOptions): Promise<{ canceled: boolean; filePath?: string }> {
    console.warn('[electron-to-web] showSaveDialog not supported in server context');
    console.log('[electron-to-web] Dialog options:', options);
    return { canceled: true };
  }

  /**
   * Show message box (logs to console in server context)
   */
  async showMessageBox(options: MessageBoxOptions): Promise<{ response: number; checkboxChecked: boolean }> {
    console.log(`[electron-to-web] MessageBox (${options.type || 'none'}): ${options.title || ''}`);
    console.log(`[electron-to-web] ${options.message}`);
    if (options.detail) {
      console.log(`[electron-to-web] ${options.detail}`);
    }
    return { response: 0, checkboxChecked: false };
  }

  /**
   * Show error box (logs to console in server context)
   */
  showErrorBox(title: string, content: string): void {
    console.error(`[electron-to-web] Error: ${title}`);
    console.error(`[electron-to-web] ${content}`);
  }
}

// Singleton instance
export const dialog = new Dialog();
