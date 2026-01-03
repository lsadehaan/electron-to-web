/**
 * Simple test server to verify electron-to-web works
 */

import { ipcMain, BrowserWindow } from '../../dist/main/index.js';
import { createWebServer } from '../../dist/server/index.js';

console.log('[Test] Setting up IPC handlers...');

const mainWindow = new BrowserWindow();

// Register ping handler
ipcMain.handle('ping', async (event, message) => {
  console.log('[Test] Received ping:', message);

  // Send pong notification back to client
  mainWindow.webContents.send('pong', `Echo: ${message}`);

  return {
    success: true,
    timestamp: Date.now(),
    message: 'Pong!',
  };
});

// Register echo handler
ipcMain.handle('echo', async (event, ...args) => {
  console.log('[Test] Received echo:', args);
  return args;
});

// Create web server
async function startServer() {
  console.log('[Test] Starting web server...');
  const { app, server, wss } = await createWebServer({
    port: 3001,
    staticDir: './public',
    cors: true,
    onConnection: (ws, clientId) => {
      console.log(`[Test] Client connected: ${clientId}`);
    },
    onDisconnect: (clientId) => {
      console.log(`[Test] Client disconnected: ${clientId}`);
    },
  });

  console.log('[Test] Server ready on http://localhost:3001');
  console.log('[Test] WebSocket ready on ws://localhost:3001/ipc');
  console.log('[Test] Press Ctrl+C to stop');
}

startServer().catch((error) => {
  console.error('[Test] Failed to start server:', error);
  process.exit(1);
});
