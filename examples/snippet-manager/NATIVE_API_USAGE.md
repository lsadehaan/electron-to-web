# Native API Usage Reference

This document maps all native API usage in the Code Snippet Manager to show exactly how electron-to-web will shim them.

## API Mapping

### 1. App API (`app`)

**Usage in `main.js`:**
```javascript
const userDataPath = app.getPath('userData');
const appName = app.getName();
const appVersion = app.getVersion();
```

**electron-to-web Shim:**
- `app.getPath('userData')` → Returns server-side user data directory
- `app.getName()` → Returns package.json name
- `app.getVersion()` → Returns package.json version

**Works in Web:** ✅ Yes, with security configuration

---

### 2. Shell API (`shell`)

**Usage in `main.js`:**
```javascript
// Open folder in file explorer
ipcMain.handle('shell:openSnippetsFolder', async () => {
  const result = await shell.openPath(snippetsDir);
  return { success: !result, error: result };
});

// Open URL in browser
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
});
```

**electron-to-web Shim:**
- Server-side (requires security config):
  - `shell.openPath()` → Opens file/folder on server
  - `shell.showItemInFolder()` → Shows item in file manager
- Client-side (no security config needed):
  - `shell.openExternal()` → Uses `window.open()` in browser

**Works in Web:**
- `openExternal`: ✅ Yes, client-side using `window.open()`
- `openPath`: ⚠️ Server-side only, requires security configuration

---

### 3. Dialog API (`dialog`)

**Usage in `main.js`:**
```javascript
// Open file dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Snippet File',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
});

// Save file dialog
ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Snippet',
    defaultPath: defaultName || 'snippet.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
});

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folder',
    properties: ['openDirectory']
  });
});
```

**electron-to-web Shim (Renderer-side):**
- `dialog.showOpenDialog()` → File System Access API + fallback to `<input type="file">`
- `dialog.showSaveDialog()` → File System Access API + fallback
- Returns same structure: `{ canceled, filePaths }`

**Works in Web:** ✅ Yes, using Web File System Access API (Chrome/Edge) or fallback

---

### 4. Clipboard API (`clipboard`)

**Usage in `main.js`:**
```javascript
ipcMain.handle('clipboard:writeText', async (event, text) => {
  clipboard.writeText(text);

  // Show notification
  new Notification({
    title: 'Copied to Clipboard',
    body: 'Snippet code has been copied'
  }).show();
});

ipcMain.handle('clipboard:readText', async () => {
  const text = clipboard.readText();
  return { success: true, text };
});
```

**electron-to-web Shim (Renderer-side):**
- `clipboard.writeText()` → `navigator.clipboard.writeText()`
- `clipboard.readText()` → `navigator.clipboard.readText()`
- `clipboard.writeHTML()` → `navigator.clipboard.write()` with HTML blob
- `clipboard.writeImage()` → `navigator.clipboard.write()` with image blob

**Works in Web:** ✅ Yes, using Web Clipboard API (requires HTTPS)

---

### 5. Notification API (`Notification`)

**Usage in `main.js`:**
```javascript
if (Notification.isSupported()) {
  new Notification({
    title: 'Snippet Saved',
    body: `"${snippet.title}" has been saved successfully`
  }).show();
}
```

**electron-to-web Shim (Renderer-side):**
- `new Notification(options)` → Web Notification API
- `Notification.isSupported()` → Check `'Notification' in window`
- `notification.show()` → Triggers browser notification
- Events: `click`, `close`, `show`, `error`

**Works in Web:** ✅ Yes, using Web Notification API (requires permission)

---

### 6. File System (`fs`)

**Usage in `main.js`:**
```javascript
// Read directory
const files = await fs.readdir(snippetsDir);

// Read file
const content = await fs.readFile(filePath, 'utf-8');

// Write file
await fs.writeFile(filePath, JSON.stringify(data, null, 2));

// Delete file
await fs.unlink(filePath);

// Create directory
await fs.mkdir(snippetsDir, { recursive: true });
```

**electron-to-web:**
- File system operations work on the **server side** only
- Client cannot access file system directly (browser security)
- IPC handlers perform file operations and return results

**Works in Web:** ✅ Yes, on server side (no special shim needed)

---

## Security Considerations for Web Deployment

### Client-Side APIs (No Security Config Needed)

These work directly in the browser:
- ✅ `clipboard` - Uses `navigator.clipboard`
- ✅ `dialog` - Uses File System Access API + fallback
- ✅ `Notification` - Uses Web Notification API
- ✅ `shell.openExternal()` - Uses `window.open()`

### Server-Side APIs (Require Security Config)

These require explicit security configuration:
- ⚠️ `shell.openPath()` - Requires `allowShellExecution: true`
- ⚠️ `shell.showItemInFolder()` - Requires `allowShellExecution: true`
- ⚠️ `app.getPath()` - Requires `allowPathQueries: true`

### Example Security Configuration

```javascript
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';

// Option 1: Enable all operations (trusted environments only)
createWebServer({
  port: 3001,
  security: TRUSTED_SECURITY_CONFIG
});

// Option 2: Custom security policy
createWebServer({
  port: 3001,
  security: {
    allowShellExecution: true,
    allowPathQueries: true,
    allowedPaths: [
      '/home/user/snippets',  // Whitelist specific paths
    ],
    validateFilePath: (path) => {
      return !path.includes('..'); // Prevent directory traversal
    }
  }
});
```

---

## Testing Checklist

When migrating to web, test these scenarios:

### Clipboard
- [ ] Copy snippet code
- [ ] Paste from clipboard
- [ ] Test on HTTPS (clipboard requires secure context)

### Dialog
- [ ] Open file dialog (single file)
- [ ] Open file dialog (multiple files)
- [ ] Open folder dialog
- [ ] Save file dialog
- [ ] Test on Chrome/Edge (File System Access API)
- [ ] Test on Firefox/Safari (fallback to input)

### Notification
- [ ] Request permission
- [ ] Show notification on save
- [ ] Show notification on copy
- [ ] Click notification
- [ ] Test permission denied state

### Shell
- [ ] Open snippets folder (server-side)
- [ ] Open external URL (client-side)
- [ ] Test security validation

### File System
- [ ] Create snippet (write file)
- [ ] Read snippet (read file)
- [ ] Update snippet (write file)
- [ ] Delete snippet (unlink file)
- [ ] List all snippets (readdir)

---

## Migration Impact

**Total Code Changes Required:** 0 lines in main.js

**Why?** All native APIs are shimmed by electron-to-web, so the exact same IPC handlers work in both Electron and web environments.

**Only Changes Needed:**
1. Server setup: Replace Electron `app.whenReady()` with `createWebServer()`
2. Renderer: Replace `import { ipcRenderer } from 'electron'` with `import { ipcRenderer } from 'electron-to-web/renderer'`
3. Build config: Add module aliasing for automatic replacement

That's it! 🎉
