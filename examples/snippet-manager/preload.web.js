/**
 * Preload Script - Web Version
 *
 * ARCHITECTURE NOTE:
 * This preload demonstrates the key difference between Electron and electron-to-web:
 *
 * CLIENT-SIDE (this file):
 * - Dialog operations (File System Access API)
 * - File reading/writing (FileHandle API)
 * - Clipboard, Notifications (browser APIs)
 *
 * SERVER-SIDE (via IPC):
 * - Snippet CRUD (file system on server)
 * - App info (server paths)
 * - Shell operations (opening server folders)
 *
 * The API exposed to renderer.js is IDENTICAL to the Electron version,
 * but the implementation is split between client and server.
 */

import { ipcRenderer, dialog } from 'electron-to-web/renderer';

// Store file handles for import/export (File System Access API)
// File System Access API gives us FileHandles, not file paths
const fileHandles = new Map();

// Expose the exact same API as the Electron version
window.snippetAPI = {
  // Snippet operations
  getAllSnippets: () => ipcRenderer.invoke('snippets:getAll'),
  getSnippet: (id) => ipcRenderer.invoke('snippets:get', id),
  saveSnippet: (snippet) => ipcRenderer.invoke('snippets:save', snippet),
  deleteSnippet: (id) => ipcRenderer.invoke('snippets:delete', id),

  // Export snippet (client-side file writing using File System Access API)
  exportSnippet: async (snippet, fileName) => {
    try {
      const handle = fileHandles.get(fileName);
      if (!handle) {
        return { success: false, error: 'File handle not found' };
      }

      const data = {
        title: snippet.title,
        language: snippet.language,
        code: snippet.code,
        description: snippet.description || '',
        tags: snippet.tags || [],
        exportedAt: new Date().toISOString()
      };

      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();

      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Snippet Exported', {
          body: `Exported to ${fileName}`
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Import snippet (client-side file reading + server-side save)
  importSnippet: async (fileName) => {
    try {
      const handle = fileHandles.get(fileName);
      if (!handle) {
        return { success: false, error: 'File handle not found' };
      }

      const file = await handle.getFile();
      const content = await file.text();
      const snippet = JSON.parse(content);

      // Save to server
      const data = {
        title: snippet.title || 'Imported Snippet',
        language: snippet.language || 'text',
        code: snippet.code || '',
        description: snippet.description || '',
        tags: snippet.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await ipcRenderer.invoke('snippets:save', data);

      if (result.success) {
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Snippet Imported', {
            body: `"${data.title}" imported successfully`
          });
        }
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Clipboard operations
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  readFromClipboard: () => ipcRenderer.invoke('clipboard:readText'),

  // Shell operations
  openSnippetsFolder: () => ipcRenderer.invoke('shell:openSnippetsFolder'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Dialog operations (handled client-side using File System Access API)
  openFolderDialog: async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Folder to Import Snippets',
      properties: ['openDirectory']
    });
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    return { success: true, folderPath: result.filePaths[0] };
  },
  openFileDialog: async () => {
    try {
      // @ts-ignore - showOpenFilePicker is a newer API
      const handles = await window.showOpenFilePicker({
        types: [{
          description: 'JSON Files',
          accept: { '*/*': ['.json'] }
        }],
        multiple: true
      });

      // Store handles and get file names
      const filePaths = await Promise.all(handles.map(async (handle) => {
        const file = await handle.getFile();
        fileHandles.set(file.name, handle);
        return file.name;
      }));

      return { success: true, filePaths };
    } catch (error) {
      return { success: false, canceled: true };
    }
  },
  saveFileDialog: async (defaultName) => {
    try {
      // @ts-ignore - showSaveFilePicker is a newer API
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName || 'snippet.json',
        types: [{
          description: 'JSON Files',
          accept: { '*/*': ['.json'] }
        }]
      });

      const file = await handle.getFile();
      fileHandles.set(file.name, handle);
      return { success: true, filePath: file.name };
    } catch (error) {
      return { success: false, canceled: true };
    }
  },

  // App info
  getAppInfo: () => ipcRenderer.invoke('app:getInfo')
};

console.log('✅ Snippet API ready!', window.snippetAPI);

// Dispatch event to let renderer know API is ready
window.dispatchEvent(new Event('snippetAPIReady'));
