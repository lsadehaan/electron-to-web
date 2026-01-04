/**
 * Code Snippet Manager - Web Server
 *
 * This is the EXACT same logic as main.js, but runs on the web!
 * All IPC handlers are identical - electron-to-web makes them work over WebSocket.
 */

import { ipcMain, BrowserWindow, shell, dialog, clipboard, Notification } from 'electron-to-web/main';
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// ============================================
// Configuration
// ============================================

// Get snippets directory (different from Electron - uses ./data instead of app.getPath)
function getSnippetsDir() {
  return path.join(__dirname, '../data/snippets');
}

// Ensure snippets directory exists
async function ensureSnippetsDir() {
  const snippetsDir = getSnippetsDir();
  try {
    await fs.mkdir(snippetsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create snippets directory:', error);
  }
  return snippetsDir;
}

// ============================================
// IPC Handlers - Copied EXACTLY from main.js
// ============================================

// Get all snippets
ipcMain.handle('snippets:getAll', async () => {
  try {
    const snippetsDir = await ensureSnippetsDir();
    const files = await fs.readdir(snippetsDir);

    const snippets = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(snippetsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const snippet = JSON.parse(content);
        snippets.push({ ...snippet, id: path.basename(file, '.json') });
      }
    }

    return { success: true, snippets };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get single snippet
ipcMain.handle('snippets:get', async (event, snippetId) => {
  try {
    const snippetsDir = await ensureSnippetsDir();
    const filePath = path.join(snippetsDir, `${snippetId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const snippet = JSON.parse(content);

    return { success: true, snippet: { ...snippet, id: snippetId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create or update snippet
ipcMain.handle('snippets:save', async (event, snippet) => {
  try {
    const snippetsDir = await ensureSnippetsDir();
    const snippetId = snippet.id || Date.now().toString();
    const filePath = path.join(snippetsDir, `${snippetId}.json`);

    const data = {
      title: snippet.title,
      language: snippet.language,
      code: snippet.code,
      description: snippet.description || '',
      tags: snippet.tags || [],
      createdAt: snippet.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    // Send notification (works via web Notification API on client)
    if (Notification.isSupported()) {
      new Notification({
        title: 'Snippet Saved',
        body: `"${snippet.title}" has been saved successfully`
      }).show();
    }

    return { success: true, snippet: { ...data, id: snippetId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete snippet
ipcMain.handle('snippets:delete', async (event, snippetId) => {
  try {
    const snippetsDir = await ensureSnippetsDir();
    const filePath = path.join(snippetsDir, `${snippetId}.json`);
    await fs.unlink(filePath);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC Handlers - Native APIs
// ============================================

// Copy snippet code to clipboard (uses Web Clipboard API on client)
ipcMain.handle('clipboard:writeText', async (event, text) => {
  try {
    clipboard.writeText(text);

    // Send notification
    if (Notification.isSupported()) {
      new Notification({
        title: 'Copied to Clipboard',
        body: 'Snippet code has been copied'
      }).show();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read text from clipboard
ipcMain.handle('clipboard:readText', async () => {
  try {
    const text = clipboard.readText();
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open snippets folder in file explorer (server-side operation)
ipcMain.handle('shell:openSnippetsFolder', async () => {
  try {
    const snippetsDir = await ensureSnippetsDir();
    const result = await shell.openPath(snippetsDir);

    if (result) {
      return { success: false, error: result };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open URL in default browser (client-side operation via window.open)
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Show open folder dialog (uses File System Access API on client)
ipcMain.handle('dialog:openFolder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Folder to Import Snippets',
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Show open file dialog (uses File System Access API on client)
ipcMain.handle('dialog:openFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Snippet File',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePaths: result.filePaths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Show save dialog (uses File System Access API on client)
ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Snippet',
      defaultPath: defaultName || 'snippet.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export snippet to file
ipcMain.handle('snippets:export', async (event, snippet, filePath) => {
  try {
    const data = {
      title: snippet.title,
      language: snippet.language,
      code: snippet.code,
      description: snippet.description || '',
      tags: snippet.tags || [],
      exportedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    if (Notification.isSupported()) {
      new Notification({
        title: 'Snippet Exported',
        body: `Exported to ${path.basename(filePath)}`
      }).show();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Import snippet from file
ipcMain.handle('snippets:import', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const snippet = JSON.parse(content);

    // Save to snippets directory
    const snippetsDir = await ensureSnippetsDir();
    const snippetId = Date.now().toString();
    const destPath = path.join(snippetsDir, `${snippetId}.json`);

    const data = {
      title: snippet.title || 'Imported Snippet',
      language: snippet.language || 'text',
      code: snippet.code || '',
      description: snippet.description || '',
      tags: snippet.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(destPath, JSON.stringify(data, null, 2));

    if (Notification.isSupported()) {
      new Notification({
        title: 'Snippet Imported',
        body: `"${data.title}" imported successfully`
      }).show();
    }

    return { success: true, snippet: { ...data, id: snippetId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get app info
ipcMain.handle('app:getInfo', async () => {
  // Read package.json for app info
  const packageJson = JSON.parse(
    await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8')
  );

  return {
    name: packageJson.name,
    version: packageJson.version,
    userDataPath: path.join(__dirname, '../data'),
    snippetsPath: getSnippetsDir()
  };
});

// ============================================
// Start Web Server
// ============================================

async function startServer() {
  // Create BrowserWindow instance (required for some APIs)
  mainWindow = new BrowserWindow();

  // Ensure data directory exists
  await ensureSnippetsDir();

  // Start web server with electron-to-web
  const { app, server, wss } = createWebServer({
    port: 3002,
    staticDir: path.join(__dirname, '../web-dist'),

    // Security config - enables all native APIs for demo
    // In production, use custom security config!
    security: TRUSTED_SECURITY_CONFIG,

    // Enable CORS for development
    cors: true,

    // WebSocket path
    wsPath: '/ipc'
  });

  console.log('');
  console.log('🚀 Code Snippet Manager - Web Server Started!');
  console.log('');
  console.log('   URL:       http://localhost:3001');
  console.log('   WebSocket: ws://localhost:3001/ipc');
  console.log('   Snippets:  ' + getSnippetsDir());
  console.log('');
  console.log('✅ All IPC handlers registered');
  console.log('📝 Native APIs enabled: app, shell, dialog, clipboard, Notification');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
