/**
 * Session API shim
 * Maps Electron's session API to minimal server equivalents
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/session
 *
 * Note: Full session management requires browser context. This is a minimal shim.
 */

export class Session {
  /**
   * Get cookies (not supported in server context)
   */
  get cookies(): any {
    console.warn('[electron-to-web] session.cookies not supported in server context');
    return {
      get: async () => [],
      set: async () => {},
      remove: async () => {},
    };
  }

  /**
   * Clear cache (no-op in server context)
   */
  async clearCache(): Promise<void> {
    console.log('[electron-to-web] clearCache called (no-op in server context)');
  }

  /**
   * Clear storage data (no-op in server context)
   */
  async clearStorageData(options?: any): Promise<void> {
    console.log('[electron-to-web] clearStorageData called (no-op in server context)', options);
  }

  /**
   * Get cache size (returns 0 in server context)
   */
  async getCacheSize(): Promise<number> {
    return 0;
  }

  /**
   * Set download path (no-op in server context)
   */
  setDownloadPath(path: string): void {
    console.log(`[electron-to-web] setDownloadPath called: ${path} (no-op in server context)`);
  }
}

// Default session instance
export const session = {
  defaultSession: new Session(),
  fromPartition(_partition: string): Session {
    return new Session();
  },
};
