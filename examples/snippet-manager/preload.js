/**
 * Preload Script - Exposes safe IPC APIs to renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('snippetAPI', {
  // Snippet operations
  getAllSnippets: () => ipcRenderer.invoke('snippets:getAll'),
  getSnippet: (id) => ipcRenderer.invoke('snippets:get', id),
  saveSnippet: (snippet) => ipcRenderer.invoke('snippets:save', snippet),
  deleteSnippet: (id) => ipcRenderer.invoke('snippets:delete', id),
  exportSnippet: (snippet, filePath) => ipcRenderer.invoke('snippets:export', snippet, filePath),
  importSnippet: (filePath) => ipcRenderer.invoke('snippets:import', filePath),

  // Clipboard operations
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  readFromClipboard: () => ipcRenderer.invoke('clipboard:readText'),

  // Shell operations
  openSnippetsFolder: () => ipcRenderer.invoke('shell:openSnippetsFolder'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Dialog operations
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),

  // App info
  getAppInfo: () => ipcRenderer.invoke('app:getInfo')
});
