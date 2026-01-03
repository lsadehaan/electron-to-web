/**
 * Test server for E2E tests
 * Provides a minimal set of IPC handlers for testing
 */

import { ipcMain, BrowserWindow } from '../dist/main/index.js';
import { createWebServer } from '../dist/server/index.js';

const mainWindow = new BrowserWindow();
const receivedMessages = []; // Track received one-way messages

// ============================================================================
// INVOKE HANDLERS (ipcMain.handle)
// ============================================================================

// Register echo handler - returns all arguments as-is
ipcMain.handle('echo', async (event, ...args) => {
  return args;
});

// Register ping handler - sends notification back and returns response
ipcMain.handle('ping', async (event, message) => {
  // Send notification back to client
  mainWindow.webContents.send('pong', `Echo: ${message}`);

  // Return response
  return {
    success: true,
    timestamp: Date.now(),
    message: 'Pong!',
  };
});

// Handler for testing handleOnce
ipcMain.handleOnce('handle-once-test', async (event, data) => {
  return { received: data, handled: true };
});

// Handler for testing removal
ipcMain.handle('removable-handler', async (event) => {
  return { removed: false };
});

// Handler to get received one-way messages (for testing ipcMain.on)
ipcMain.handle('get-received-messages', async (event) => {
  return [...receivedMessages];
});

// Handler to clear received messages
ipcMain.handle('clear-received-messages', async (event) => {
  receivedMessages.length = 0;
  return { cleared: true };
});

// ============================================================================
// ONE-WAY MESSAGE LISTENERS (ipcMain.on)
// ============================================================================

// Listen for one-way messages
ipcMain.on('one-way-message', (event, ...args) => {
  receivedMessages.push({ channel: 'one-way-message', args });
  console.log('[Test Server] Received one-way message:', args);
});

// Multiple listeners on same channel
ipcMain.on('multi-listener-test', (event, data) => {
  receivedMessages.push({ listener: 'first', data });
});

ipcMain.on('multi-listener-test', (event, data) => {
  receivedMessages.push({ listener: 'second', data });
});

// Once listener for testing
ipcMain.once('once-listener-test', (event, data) => {
  receivedMessages.push({ type: 'once', data });
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
