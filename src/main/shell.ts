/**
 * Shell API shim
 * Maps Electron's shell API to Node.js equivalents
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/shell
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class Shell {
  /**
   * Open an external URL in the default browser
   */
  async openExternal(url: string): Promise<void> {
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else if (platform === 'darwin') {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    await execAsync(command);
  }

  /**
   * Open a file or directory in the default application
   */
  async openPath(path: string): Promise<string> {
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      command = `start "" "${path}"`;
    } else if (platform === 'darwin') {
      command = `open "${path}"`;
    } else {
      command = `xdg-open "${path}"`;
    }

    try {
      await execAsync(command);
      return ''; // Empty string indicates success in Electron
    } catch (error) {
      return (error as Error).message;
    }
  }

  /**
   * Show the given file in a file manager (select/reveal)
   */
  showItemInFolder(fullPath: string): void {
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      command = `explorer /select,"${fullPath}"`;
    } else if (platform === 'darwin') {
      command = `open -R "${fullPath}"`;
    } else {
      // Linux doesn't have a standard way, just open the directory
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      command = `xdg-open "${dir}"`;
    }

    exec(command);
  }

  /**
   * Move an item to the trash (not supported in server context)
   */
  async trashItem(_path: string): Promise<void> {
    throw new Error('trashItem is not supported in server context');
  }
}

// Singleton instance
export const shell = new Shell();
