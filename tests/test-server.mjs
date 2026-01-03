/**
 * Test server for E2E tests
 * Provides a minimal set of IPC handlers for testing
 */

import { ipcMain, BrowserWindow } from '../dist/main/index.js';
import { createWebServer } from '../dist/server/index.js';

// Register echo handler - returns all arguments as-is
ipcMain.handle('echo', async (event, ...args) => {
  return args;
});

// Register ping handler - sends notification back and returns response
ipcMain.handle('ping', async (event, message) => {
  // Send notification back to client
  const mainWindow = new BrowserWindow();
  mainWindow.webContents.send('pong', `Echo: ${message}`);

  // Return response
  return {
    success: true,
    timestamp: Date.now(),
    message: 'Pong!',
  };
});

// Start server
async function start() {
  try {
    const { app, server, wss } = await createWebServer({
      port: 3001,
      cors: true,
      onConnection: (ws, clientId) => {
        // Silent in test mode
      },
      onDisconnect: (clientId) => {
        // Silent in test mode
      },
    });

    console.log('Server ready');

    // Handle shutdown gracefully
    process.on('SIGTERM', () => {
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
