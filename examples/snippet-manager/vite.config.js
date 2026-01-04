/**
 * Vite Configuration for Web Build
 *
 * This config builds the frontend for web deployment.
 */

import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: '.',

  build: {
    outDir: 'web-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.web.html'),
        preload: resolve(__dirname, 'preload.web.js')
      },
      output: {
        // Don't hash the preload file name
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'preload') {
            return 'preload.js';
          }
          return '[name]-[hash].js';
        }
      }
    }
  },

  resolve: {
    alias: {
      // Auto-replace electron-to-web imports with local build
      'electron-to-web/renderer': resolve(__dirname, '../../dist/renderer/index.js')
    }
  },

  // Development server (optional, for testing frontend separately)
  server: {
    port: 5173,
    proxy: {
      // Proxy WebSocket connections to backend
      '/ipc': {
        target: 'ws://localhost:3002',
        ws: true
      }
    }
  }
});
