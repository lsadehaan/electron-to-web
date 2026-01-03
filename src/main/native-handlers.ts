/**
 * Server-side handlers for native Electron APIs
 * Requires explicit security configuration to enable
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import type { SecurityConfig } from '../shared/security-config.js';
import { ipcMain } from './ipc-main.js';

const execAsync = promisify(exec);

/**
 * Register native API handlers with security checks
 * @param securityConfig - Security configuration
 */
export function registerNativeHandlers(securityConfig: Required<SecurityConfig>): void {
  // ============================================================================
  // SHELL OPERATIONS
  // ============================================================================

  /**
   * Open file/path in OS default application
   */
  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    // Security check
    if (!securityConfig.allowShellExecution) {
      throw new Error('[Security] shell:openPath not allowed. Enable allowShellExecution in server config.');
    }

    if (securityConfig.allowFileSystemAccess && !securityConfig.validateFilePath(filePath)) {
      throw new Error(`[Security] Path not allowed: ${filePath}`);
    }

    // Validate path exists and is safe
    const normalizedPath = path.normalize(filePath);

    try {
      let command: string;

      switch (os.platform()) {
        case 'win32':
          command = `start "" "${normalizedPath}"`;
          break;
        case 'darwin':
          command = `open "${normalizedPath}"`;
          break;
        default: // linux
          command = `xdg-open "${normalizedPath}"`;
          break;
      }

      if (!securityConfig.validateShellCommand(command, [normalizedPath])) {
        throw new Error('[Security] Shell command not allowed by validator');
      }

      await execAsync(command);
      return { success: true };
    } catch (error) {
      console.error('[shell:openPath] Error:', error);
      throw new Error(`Failed to open path: ${(error as Error).message}`);
    }
  });

  /**
   * Show file in file manager
   */
  ipcMain.handle('shell:showItemInFolder', async (_event, fullPath: string) => {
    if (!securityConfig.allowShellExecution) {
      throw new Error('[Security] shell:showItemInFolder not allowed. Enable allowShellExecution in server config.');
    }

    if (securityConfig.allowFileSystemAccess && !securityConfig.validateFilePath(fullPath)) {
      throw new Error(`[Security] Path not allowed: ${fullPath}`);
    }

    const normalizedPath = path.normalize(fullPath);

    try {
      let command: string;

      switch (os.platform()) {
        case 'win32':
          command = `explorer /select,"${normalizedPath}"`;
          break;
        case 'darwin':
          command = `open -R "${normalizedPath}"`;
          break;
        default: // linux
          // Most linux file managers support opening parent directory
          const dirname = path.dirname(normalizedPath);
          command = `xdg-open "${dirname}"`;
          break;
      }

      if (!securityConfig.validateShellCommand(command, [normalizedPath])) {
        throw new Error('[Security] Shell command not allowed by validator');
      }

      await execAsync(command);
      return { success: true };
    } catch (error) {
      console.error('[shell:showItemInFolder] Error:', error);
      throw new Error(`Failed to show item: ${(error as Error).message}`);
    }
  });

  /**
   * Move item to trash
   */
  ipcMain.handle('shell:trashItem', async (_event, fullPath: string) => {
    if (!securityConfig.allowShellExecution || !securityConfig.allowFileSystemAccess) {
      throw new Error('[Security] shell:trashItem not allowed. Enable allowShellExecution and allowFileSystemAccess.');
    }

    if (!securityConfig.validateFilePath(fullPath)) {
      throw new Error(`[Security] Path not allowed: ${fullPath}`);
    }

    const normalizedPath = path.normalize(fullPath);

    try {
      // Note: This is a basic implementation. For production, consider using
      // a library like 'trash' for proper cross-platform trash functionality
      let command: string;

      switch (os.platform()) {
        case 'win32':
          // PowerShell command to move to recycle bin
          command = `powershell.exe -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${normalizedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;
          break;
        case 'darwin':
          command = `osascript -e 'tell application "Finder" to delete POSIX file "${normalizedPath}"'`;
          break;
        default: // linux
          // gio trash is available on most modern Linux systems
          command = `gio trash "${normalizedPath}"`;
          break;
      }

      if (!securityConfig.validateShellCommand(command, [normalizedPath])) {
        throw new Error('[Security] Shell command not allowed by validator');
      }

      await execAsync(command);
      return { success: true };
    } catch (error) {
      console.error('[shell:trashItem] Error:', error);
      throw new Error(`Failed to trash item: ${(error as Error).message}`);
    }
  });

  // ============================================================================
  // APP PATH OPERATIONS
  // ============================================================================

  /**
   * Get app paths (safer than full filesystem access)
   */
  ipcMain.handle('app:getPath', async (_event, name: string) => {
    if (!securityConfig.allowPathQueries) {
      throw new Error('[Security] app:getPath not allowed. Enable allowPathQueries in server config.');
    }

    try {
      let appPath: string;

      switch (name) {
        case 'home':
          appPath = os.homedir();
          break;
        case 'appData':
          appPath = process.env.APPDATA || path.join(os.homedir(), '.config');
          break;
        case 'userData':
          appPath = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'electron-to-web');
          break;
        case 'temp':
          appPath = os.tmpdir();
          break;
        case 'downloads':
          appPath = path.join(os.homedir(), 'Downloads');
          break;
        case 'documents':
          appPath = path.join(os.homedir(), 'Documents');
          break;
        case 'desktop':
          appPath = path.join(os.homedir(), 'Desktop');
          break;
        default:
          throw new Error(`Unknown path name: ${name}`);
      }

      return { path: appPath };
    } catch (error) {
      console.error('[app:getPath] Error:', error);
      throw new Error(`Failed to get path: ${(error as Error).message}`);
    }
  });

  console.log('[electron-to-web] Native API handlers registered with security config:', {
    allowShellExecution: securityConfig.allowShellExecution,
    allowFileSystemAccess: securityConfig.allowFileSystemAccess,
    allowPathQueries: securityConfig.allowPathQueries,
    allowedPathsCount: securityConfig.allowedPaths.length,
  });
}

/**
 * Unregister all native API handlers
 */
export function unregisterNativeHandlers(): void {
  ipcMain.removeHandler('shell:openPath');
  ipcMain.removeHandler('shell:showItemInFolder');
  ipcMain.removeHandler('shell:trashItem');
  ipcMain.removeHandler('app:getPath');

  console.log('[electron-to-web] Native API handlers unregistered');
}
