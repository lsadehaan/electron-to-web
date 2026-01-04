# Code Snippet Manager - Electron Example

A comprehensive example app demonstrating **all major native APIs** that can be shimmed by electron-to-web.

## Features Demonstrated

This example showcases the following Electron native APIs:

### 1. App API (`app`)
- ✅ `app.getPath('userData')` - Get user data directory
- ✅ `app.getName()` - Get application name
- ✅ `app.getVersion()` - Get application version

### 2. Shell API (`shell`)
- ✅ `shell.openPath()` - Open folders in file explorer
- ✅ `shell.openExternal()` - Open URLs in default browser

### 3. Dialog API (`dialog`)
- ✅ `dialog.showOpenDialog()` - Select files/folders
- ✅ `dialog.showSaveDialog()` - Save file dialog

### 4. Clipboard API (`clipboard`)
- ✅ `clipboard.writeText()` - Copy text to clipboard
- ✅ `clipboard.readText()` - Read text from clipboard

### 5. Notification API (`Notification`)
- ✅ `new Notification()` - Show desktop notifications
- ✅ Notifications on save, copy, import, export

### 6. File System (`fs`)
- ✅ Reading snippet files
- ✅ Writing snippet files
- ✅ Listing directory contents
- ✅ Creating directories

## What This App Does

**Code Snippet Manager** is a simple but practical application that lets you:
- Create and organize code snippets
- Search through your snippets
- Import/export snippets as JSON files
- Copy snippets to clipboard
- Tag and categorize snippets
- Store snippets in your user data folder

## Running the Electron Version

### Install Dependencies

```bash
npm install
```

### Start the App

```bash
npm start
```

### Development Mode (with DevTools)

```bash
npm run dev
```

## File Structure

```
snippet-manager/
├── main.js           # Main process - IPC handlers & native API usage
├── preload.js        # Preload script - exposes safe APIs to renderer
├── renderer.js       # Renderer process - UI logic
├── index.html        # HTML structure
├── styles.css        # UI styling
├── package.json      # NPM config
└── README.md         # This file
```

## Key Implementation Details

### Main Process (`main.js`)

All IPC handlers demonstrate native API usage:

```javascript
// App API - Get snippets directory
const userDataPath = app.getPath('userData');
const snippetsDir = path.join(userDataPath, 'snippets');

// Shell API - Open folder
ipcMain.handle('shell:openSnippetsFolder', async () => {
  await shell.openPath(snippetsDir);
});

// Dialog API - Save file
ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  return result;
});

// Clipboard API - Copy text
ipcMain.handle('clipboard:writeText', async (event, text) => {
  clipboard.writeText(text);
  new Notification({ title: 'Copied!' }).show();
});
```

### Preload Script (`preload.js`)

Exposes safe APIs using `contextBridge`:

```javascript
contextBridge.exposeInMainWorld('snippetAPI', {
  getAllSnippets: () => ipcRenderer.invoke('snippets:getAll'),
  saveSnippet: (snippet) => ipcRenderer.invoke('snippets:save', snippet),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  openSnippetsFolder: () => ipcRenderer.invoke('shell:openSnippetsFolder'),
  // ... more APIs
});
```

### Renderer Process (`renderer.js`)

Uses the exposed APIs:

```javascript
// Copy snippet to clipboard
await window.snippetAPI.copyToClipboard(code);

// Open snippets folder
await window.snippetAPI.openSnippetsFolder();

// Export snippet
const result = await window.snippetAPI.saveFileDialog('snippet.json');
if (result.success) {
  await window.snippetAPI.exportSnippet(snippet, result.filePath);
}
```

## Testing Features

Once the app is running, try these features:

1. **Create Snippet** - Click "New Snippet", add code, click "Save"
2. **Copy Code** - Click "Copy" button to copy snippet to clipboard
3. **Export** - Click "Export" to save snippet as JSON file
4. **Import** - Click "Import" to load snippet from JSON file
5. **Open Folder** - Click "Open Folder" to view snippets directory
6. **Search** - Use search box to filter snippets
7. **External Links** - Click footer links to open URLs in browser

## Next Steps

After testing the Electron version, this example can be migrated to run on the web using electron-to-web. The migration will demonstrate how all these native APIs work in a browser environment with zero code changes to the main process handlers!

## Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save current snippet
- `Ctrl/Cmd + N` - Create new snippet
- `Ctrl/Cmd + K` - Copy code to clipboard

## License

MIT
