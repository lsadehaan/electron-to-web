/**
 * Code Snippet Manager - Electron Main Process
 *
 * This example demonstrates all major native APIs that can be shimmed by electron-to-web:
 * - app.getPath() - Get system paths
 * - shell.openPath() - Open folders in file explorer
 * - shell.openExternal() - Open URLs in browser
 * - dialog.showOpenDialog() - File/folder selection
 * - dialog.showSaveDialog() - Save file dialog
 * - clipboard.writeText() - Copy to clipboard
 * - Notification - Desktop notifications
 * - File system operations (fs)
 */

const { app, BrowserWindow, ipcMain, shell, dialog, clipboard, Notification } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

let mainWindow;

// Get snippets directory (in user data folder)
function getSnippetsDir() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'snippets');
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// ============================================
// IPC Handlers - Snippet Operations
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

    // Send notification
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

// Copy snippet code to clipboard
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

// Open snippets folder in file explorer
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

// Open URL in default browser
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Show open folder dialog (for importing snippets)
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

// Show open file dialog (for importing single snippet)
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

// Show save dialog (for exporting snippet)
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
  return {
    name: app.getName(),
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    snippetsPath: getSnippetsDir()
  };
});

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(async () => {
  await ensureSnippetsDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
