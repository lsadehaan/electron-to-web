/**
 * Basic Example - Server
 * Demonstrates minimal electron-to-web setup
 */

import { ipcMain, BrowserWindow } from '../../dist/main/index.js';
import { createWebServer } from '../../dist/server/index.js';

// Create "window" instance
const mainWindow = new BrowserWindow();

// Register IPC handlers
ipcMain.handle('ping', async (event, message) => {
  console.log('Received ping:', message);
  
  // Send notification back
  mainWindow.webContents.send('pong', `Echo: ${message}`);
  
  return { success: true, timestamp: Date.now() };
});

ipcMain.handle('add', async (event, a, b) => {
  return { result: a + b };
});

// Start server
const { server } = createWebServer({
  port: 3001,
  staticDir: './public' // Serve index.html from here
});

console.log('Server running on http://localhost:3001');
console.log('Open browser and check DevTools console');
