# Feature Parity: Electron vs electron-to-web

This document provides a comprehensive comparison between native Electron IPC and the `electron-to-web` implementation, detailing what works automatically, what requires adaptation, and what is not possible in web environments.

---

## Table of Contents

1. [Overview](#overview)
2. [IPC Communication](#ipc-communication)
3. [BrowserWindow APIs](#browserwindow-apis)
4. [Electron Modules](#electron-modules)
5. [Migration Checklist](#migration-checklist)
6. [Workarounds](#workarounds)

---

## Overview

### Compatibility Levels

- ✅ **100% Compatible**: Works identically, no code changes needed
- ⚠️ **Partial**: Works with minor adaptations or limitations
- 🔧 **Workaround Available**: Alternative implementation needed
- ❌ **Not Possible**: Browser security/API limitations

### Summary

| Category | ✅ Compatible | ⚠️ Partial | 🔧 Workaround | ❌ Not Possible |
|----------|--------------|-----------|--------------|----------------|
| IPC Communication | 95% | 5% | 0% | 0% |
| BrowserWindow | 10% | 0% | 0% | 90% |
| Electron Modules | 0% | 20% | 30% | 50% |

---

## IPC Communication

### Main Process (ipcMain)

| API | Status | Notes |
|-----|--------|-------|
| `ipcMain.handle(channel, listener)` | ✅ | **100% compatible**. Works identically. |
| `ipcMain.removeHandler(channel)` | ✅ | **100% compatible**. Works identically. |
| `ipcMain.on(channel, listener)` | ⚠️ | **Partial**. Use for receiving one-way messages. Notifications supported. |
| `ipcMain.once(channel, listener)` | ⚠️ | **Partial**. Can be implemented manually with `removeListener`. |
| `ipcMain.removeListener(channel, listener)` | ✅ | **100% compatible**. Works identically. |
| `ipcMain.removeAllListeners(channel)` | ✅ | **100% compatible**. Works identically. |

**Example - What Works:**
```typescript
// Electron code (works unchanged in electron-to-web)
import { ipcMain } from 'electron'; // or 'electron-to-web/main'

ipcMain.handle('user:create', async (event, userData) => {
  const user = await database.createUser(userData);
  return { success: true, user };
});

ipcMain.removeHandler('user:create');
```

**What Requires Adaptation:**
```typescript
// Electron: ipcMain.on for two-way sync
ipcMain.on('sync-message', (event, data) => {
  event.returnValue = 'sync-response'; // ❌ Not supported
});

// electron-to-web: Use handle instead
ipcMain.handle('sync-message', async (event, data) => {
  return 'async-response'; // ✅ Works
});
```

---

### Renderer Process (ipcRenderer)

| API | Status | Notes |
|-----|--------|-------|
| `ipcRenderer.invoke(channel, ...args)` | ✅ | **100% compatible**. Async request/response. |
| `ipcRenderer.send(channel, ...args)` | ✅ | **100% compatible**. Fire-and-forget notification. |
| `ipcRenderer.on(channel, listener)` | ✅ | **100% compatible**. Event listener registration. |
| `ipcRenderer.once(channel, listener)` | ✅ | **100% compatible**. One-time listener (auto-removes). |
| `ipcRenderer.removeListener(channel, listener)` | ✅ | **100% compatible**. Remove specific listener. |
| `ipcRenderer.removeAllListeners(channel?)` | ✅ | **100% compatible**. Remove all listeners for channel. |
| `ipcRenderer.sendSync(channel, ...args)` | ❌ | **Not possible**. Browsers don't support synchronous blocking I/O. Use `invoke` instead. |
| `ipcRenderer.sendToHost(channel, ...args)` | ❌ | **Not applicable**. Web frames use different communication. |

**Example - What Works:**
```typescript
// Electron code (works unchanged in electron-to-web)
import { ipcRenderer } from 'electron'; // or 'electron-to-web/renderer'

// Async request/response
const result = await ipcRenderer.invoke('user:create', userData);

// Fire-and-forget
ipcRenderer.send('log:event', { action: 'click', target: 'button' });

// Event listeners
ipcRenderer.on('notification', (event, data) => {
  console.log('Received:', data);
});

// Cleanup
ipcRenderer.removeAllListeners('notification');
```

**What Requires Adaptation:**
```typescript
// Electron: Synchronous IPC
const result = ipcRenderer.sendSync('get-config'); // ❌ Not supported

// electron-to-web: Use async invoke
const result = await ipcRenderer.invoke('get-config'); // ✅ Works
```

---

### Event Object

| Property | Status | Notes |
|----------|--------|-------|
| `event.sender` | ✅ | **Available**. Contains `{ id: clientId }` |
| `event.sender.send(channel, ...args)` | ⚠️ | **Partial**. Use `webContents.sendTo(clientId, channel, ...args)` |
| `event.reply(channel, ...args)` | ⚠️ | **Partial**. Can be implemented as `event.sender.send()` |
| `event.returnValue` | ❌ | **Not supported**. Use async `return` in handler instead |
| `event.preventDefault()` | ❌ | **Not applicable**. Handlers always complete |

**Example - Adapting Event Methods:**
```typescript
// Electron: event.returnValue (synchronous)
ipcMain.on('get-config', (event) => {
  event.returnValue = config; // ❌ Not supported
});

// electron-to-web: Use handle + return (async)
ipcMain.handle('get-config', async (event) => {
  return config; // ✅ Works
});

// Electron: event.reply
ipcMain.on('message', (event, data) => {
  event.reply('response', result); // ⚠️ Works but different pattern
});

// electron-to-web: Use webContents.send
ipcMain.handle('message', async (event, data) => {
  mainWindow.webContents.send('response', result); // ✅ Recommended
  return { success: true };
});
```

---

## BrowserWindow APIs

### webContents

| API | Status | Notes |
|-----|--------|-------|
| `webContents.send(channel, ...args)` | ✅ | **100% compatible**. Broadcasts to all clients. |
| `webContents.sendTo(id, channel, ...args)` | ✅ | **100% compatible**. Sends to specific client. |
| `webContents.executeJavaScript(code)` | ❌ | **Not possible**. Security restriction in browsers. |
| `webContents.openDevTools()` | ❌ | **Not applicable**. Use browser DevTools instead. |
| `webContents.print()` | ❌ | **Not supported**. Use `window.print()` in renderer. |
| `webContents.downloadURL(url)` | ❌ | **Not supported**. Use `<a download>` or `fetch()` in renderer. |
| `webContents.loadURL(url)` | ❌ | **Not applicable**. No window control in web apps. |

**Example - What Works:**
```typescript
import { BrowserWindow } from 'electron-to-web/main';

const mainWindow = new BrowserWindow();

// Broadcast to all clients
mainWindow.webContents.send('notification', { message: 'Hello!' });

// Send to specific client
mainWindow.webContents.sendTo('client-123', 'private-message', data);
```

**What Doesn't Work:**
```typescript
// ❌ These are desktop-only features
mainWindow.webContents.executeJavaScript('alert("hi")'); // Not supported
mainWindow.webContents.openDevTools(); // Not supported
mainWindow.webContents.print(); // Not supported
```

### Window Management

| API | Status | Notes |
|-----|--------|-------|
| `new BrowserWindow(options)` | ⚠️ | **Shim only**. Returns object for API compatibility, options ignored. |
| `win.loadURL(url)` | ❌ | **Not applicable**. |
| `win.loadFile(path)` | ❌ | **Not applicable**. |
| `win.close()` | ❌ | **Not applicable**. |
| `win.minimize()` | ❌ | **Not applicable**. |
| `win.maximize()` | ❌ | **Not applicable**. |
| `win.isMaximized()` | ❌ | **Not applicable**. |
| `win.setTitle(title)` | 🔧 | **Workaround**: Use `document.title = title` in renderer. |
| `win.on('close', handler)` | ❌ | **Not applicable**. Use `window.onbeforeunload` in renderer. |

**Shim Implementation:**
```typescript
// electron-to-web provides a minimal shim
const mainWindow = new BrowserWindow(); // Creates shim object

// Only webContents.send() works
mainWindow.webContents.send('message', data); // ✅ Works

// Window methods are no-ops
mainWindow.minimize(); // Does nothing (no-op)
mainWindow.close(); // Does nothing (no-op)
```

---

## Electron Modules

### dialog

| API | Status | Notes |
|-----|--------|-------|
| `dialog.showOpenDialog()` | 🔧 | **Workaround**: Use `<input type="file">` in renderer. |
| `dialog.showSaveDialog()` | 🔧 | **Workaround**: Use download link with `download` attribute. |
| `dialog.showMessageBox()` | 🔧 | **Workaround**: Use `window.confirm()` or custom modal. |
| `dialog.showErrorBox()` | 🔧 | **Workaround**: Use `window.alert()` or notification system. |

**Workarounds:**
```typescript
// Electron: File picker
const result = await dialog.showOpenDialog({
  properties: ['openFile'],
  filters: [{ name: 'Images', extensions: ['png', 'jpg'] }]
});

// Browser: HTML5 file input
// HTML: <input type="file" id="file-input" accept="image/png,image/jpeg">
const input = document.getElementById('file-input');
input.addEventListener('change', (e) => {
  const file = e.target.files[0];
  // Handle file
});

// Or programmatic:
const input = document.createElement('input');
input.type = 'file';
input.accept = 'image/png,image/jpeg';
input.onchange = (e) => {
  const file = (e.target as HTMLInputElement).files[0];
  // Handle file
};
input.click();
```

### clipboard

| API | Status | Notes |
|-----|--------|-------|
| `clipboard.writeText(text)` | 🔧 | **Workaround**: Use `navigator.clipboard.writeText()`. |
| `clipboard.readText()` | 🔧 | **Workaround**: Use `navigator.clipboard.readText()`. |
| `clipboard.writeImage(image)` | 🔧 | **Workaround**: Use `navigator.clipboard.write()` with blob. |
| `clipboard.readImage()` | 🔧 | **Workaround**: Use `navigator.clipboard.read()`. |

**Workarounds:**
```typescript
// Electron: Clipboard
import { clipboard } from 'electron';
clipboard.writeText('Hello');
const text = clipboard.readText();

// Browser: navigator.clipboard
await navigator.clipboard.writeText('Hello');
const text = await navigator.clipboard.readText();

// Note: Requires user gesture (click, keypress) for security
```

### shell

| API | Status | Notes |
|-----|--------|-------|
| `shell.openExternal(url)` | 🔧 | **Workaround**: Use `window.open(url, '_blank')`. |
| `shell.openPath(path)` | ❌ | **Not possible**. Filesystem not accessible. |
| `shell.showItemInFolder(path)` | ❌ | **Not possible**. Filesystem not accessible. |
| `shell.trashItem(path)` | ❌ | **Not possible**. Filesystem not accessible. |

**Workarounds:**
```typescript
// Electron: Open URL
import { shell } from 'electron';
shell.openExternal('https://example.com');

// Browser: window.open
window.open('https://example.com', '_blank');

// Electron: Show in folder (❌ No browser equivalent)
shell.showItemInFolder('/path/to/file');
```

### app

| API | Status | Notes |
|-----|--------|-------|
| `app.getPath(name)` | ❌ | **Not possible**. Filesystem not accessible. |
| `app.getVersion()` | 🔧 | **Workaround**: Hard-code or environment variable. |
| `app.getName()` | 🔧 | **Workaround**: Hard-code or package.json. |
| `app.quit()` | ❌ | **Not applicable**. Users close browser tabs. |
| `app.on('ready', handler)` | ❌ | **Not applicable**. Use server startup callback. |

**Workarounds:**
```typescript
// Electron: App paths
const userDataPath = app.getPath('userData');

// electron-to-web: Use server-side paths
import path from 'path';
import os from 'os';
const userDataPath = path.join(os.homedir(), '.my-app');

// Electron: App version
const version = app.getVersion();

// electron-to-web: Environment variable or package.json
const version = process.env.APP_VERSION || require('./package.json').version;
```

### nativeTheme

| API | Status | Notes |
|-----|--------|-------|
| `nativeTheme.shouldUseDarkColors` | 🔧 | **Workaround**: Use `window.matchMedia('(prefers-color-scheme: dark)')`. |
| `nativeTheme.on('updated', handler)` | 🔧 | **Workaround**: Use `matchMedia().addListener()`. |

**Workarounds:**
```typescript
// Electron: Dark mode detection
import { nativeTheme } from 'electron';
const isDark = nativeTheme.shouldUseDarkColors;

// Browser: matchMedia
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for changes
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    console.log('Dark mode:', e.matches);
  });
```

### powerMonitor, powerSaveBlocker

| Status | Notes |
|--------|-------|
| ❌ | **Not possible**. No browser equivalent. |

### desktopCapturer

| Status | Notes |
|--------|-------|
| ❌ | **Not possible**. Use `navigator.mediaDevices.getDisplayMedia()` for screen sharing. |

---

## Migration Checklist

### 1. IPC Communication ✅

**No changes needed** if you use:
- `ipcMain.handle()` / `ipcRenderer.invoke()`
- `ipcMain.on()` / `ipcRenderer.send()`
- `webContents.send()` / `ipcRenderer.on()`

**Changes required** if you use:
- `ipcRenderer.sendSync()` → Change to `invoke()` (async)
- `event.returnValue` → Change to `return` in handler
- `event.reply()` → Change to `webContents.send()`

### 2. File Operations 🔧

**Replace all filesystem operations:**

| Electron | Browser Equivalent |
|----------|-------------------|
| `fs.readFile()` (main) | File input + `FileReader` (renderer) |
| `fs.writeFile()` (main) | Download link or `FileSaver.js` |
| `dialog.showOpenDialog()` | `<input type="file">` |
| `dialog.showSaveDialog()` | `<a download>` attribute |

### 3. Window Management ❌

**Remove or stub:**
- Window creation, positioning, sizing
- Minimize, maximize, close controls
- Tray icons, menus

**Use web alternatives:**
- CSS for layouts
- HTML controls for UI
- Browser's native controls

### 4. System Integration ❌

**Not available in browsers:**
- System notifications (use `Notification` API instead)
- Auto-launch on startup
- Global shortcuts
- Tray icons
- Native menus

### 5. Build Configuration 🔧

**Update build tools:**

```json
// package.json
{
  "scripts": {
    "build:electron": "electron-builder",
    "build:web": "vite build --config vite.web.config.ts"
  }
}
```

**Vite config:**
```typescript
// vite.web.config.ts
export default {
  resolve: {
    alias: {
      'electron': 'electron-to-web/renderer'
    }
  }
};
```

---

## Workarounds

### File Downloads

```typescript
// Electron (main process)
import { dialog } from 'electron';

const { filePath } = await dialog.showSaveDialog({
  defaultPath: 'export.json'
});

fs.writeFileSync(filePath, JSON.stringify(data));

// Browser (renderer)
function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

downloadJSON(data, 'export.json');
```

### File Uploads

```typescript
// Electron (main process)
const { filePaths } = await dialog.showOpenDialog({
  properties: ['openFile'],
  filters: [{ name: 'JSON', extensions: ['json'] }]
});

const content = fs.readFileSync(filePaths[0], 'utf-8');
const data = JSON.parse(content);

// Browser (renderer)
function selectFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };

    input.click();
  });
}

const file = await selectFile();
const text = await file.text();
const data = JSON.parse(text);
```

### Persistent Storage

```typescript
// Electron (main process)
import Store from 'electron-store';

const store = new Store();
store.set('user.name', 'John');
const name = store.get('user.name');

// Browser (renderer) - localStorage
localStorage.setItem('user.name', 'John');
const name = localStorage.getItem('user.name');

// Or IndexedDB for larger data
import { openDB } from 'idb';

const db = await openDB('my-database', 1, {
  upgrade(db) {
    db.createObjectStore('users');
  }
});

await db.put('users', { name: 'John' }, 'current-user');
const user = await db.get('users', 'current-user');
```

### System Notifications

```typescript
// Electron (main process)
import { Notification } from 'electron';

new Notification({
  title: 'Hello',
  body: 'World'
}).show();

// Browser (renderer) - Notification API
if (Notification.permission === 'granted') {
  new Notification('Hello', { body: 'World' });
} else {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      new Notification('Hello', { body: 'World' });
    }
  });
}
```

---

## Summary

### What Works Out of the Box ✅

- All IPC communication (invoke, handle, send, on)
- Event broadcasting (webContents.send)
- Typed handlers and listeners
- Error propagation
- Connection management

### What Needs Adaptation ⚠️

- Synchronous IPC → Async IPC
- `event.returnValue` → `return` statement
- Window controls → Remove or stub

### What Requires Workarounds 🔧

- File dialogs → HTML5 file input
- Clipboard → navigator.clipboard
- Shell operations → window.open
- System paths → Server-side alternatives
- Dark mode → matchMedia

### What's Not Possible ❌

- Synchronous blocking IPC
- Native window management
- Filesystem access from renderer
- System integration (tray, auto-launch, global shortcuts)
- Desktop-only features

---

## Decision Matrix

Use **electron-to-web** if your app:
- ✅ Primarily uses IPC for communication
- ✅ Can adapt file operations to web APIs
- ✅ Doesn't rely heavily on native window controls
- ✅ Can live without system integration features

Consider **keeping Electron only** if your app:
- ❌ Requires extensive filesystem access
- ❌ Uses native menus and tray icons
- ❌ Needs synchronous IPC (rare)
- ❌ Relies on desktop-specific features

Consider **hybrid approach** if:
- ⚠️ You want both desktop and web versions
- ⚠️ Feature set differs between platforms
- ⚠️ You can abstract platform differences

---

**Last Updated:** 2026-01-03
**Version:** 1.0.0
