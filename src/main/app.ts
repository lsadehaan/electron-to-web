/**
 * App API shim
 * Maps Electron's app API to Node.js equivalents
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/app
 */

import * as os from 'os';
import * as path from 'path';

export class App {
  /**
   * Get application paths
   * Maps Electron paths to web-server equivalents
   */
  getPath(name: string): string {
    switch (name) {
      case 'home':
        return os.homedir();
      case 'appData':
        return process.env.APPDATA || path.join(os.homedir(), '.config');
      case 'userData':
        return path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'electron-to-web');
      case 'temp':
        return os.tmpdir();
      case 'downloads':
        return path.join(os.homedir(), 'Downloads');
      case 'documents':
        return path.join(os.homedir(), 'Documents');
      case 'desktop':
        return path.join(os.homedir(), 'Desktop');
      case 'exe':
        return process.execPath;
      case 'module':
        return __dirname;
      default:
        throw new Error(`Unknown path name: ${name}`);
    }
  }

  /**
   * Get the app's installation path
   */
  getAppPath(): string {
    return process.cwd();
  }

  /**
   * Get app name
   */
  getName(): string {
    return process.env.npm_package_name || 'electron-to-web-app';
  }

  /**
   * Get app version
   */
  getVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  }

  /**
   * Check if app is packaged (always false for web server)
   */
  get isPackaged(): boolean {
    return false;
  }

  /**
   * Platform shortcuts
   */
  get isLinux(): boolean {
    return process.platform === 'linux';
  }

  get isMac(): boolean {
    return process.platform === 'darwin';
  }

  get isWindows(): boolean {
    return process.platform === 'win32';
  }
}

// Singleton instance
export const app = new App();
