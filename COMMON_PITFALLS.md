# Common Pitfalls and Solutions

This guide covers common issues developers encounter when migrating Electron apps to web using electron-to-web, and how to avoid them.

## Table of Contents

- [Architecture Issues](#architecture-issues)
- [IPC and Communication](#ipc-and-communication)
- [Dialog and File System](#dialog-and-file-system)
- [Build Configuration](#build-configuration)
- [Browser Compatibility](#browser-compatibility)

---

## Architecture Issues

### ❌ Pitfall 1: Treating All Native APIs as Server-Side

**Problem**: Sending all native API calls through IPC to the server, including operations that MUST run on the client.

**Why it fails**: Some APIs like dialogs, notifications, and client-side file access can't run on a headless server.

**Solution**: Understand which APIs run where:

```
┌─────────────────────────────────────────────────────┐
│ CLIENT-SIDE ONLY (Browser APIs)                     │
├─────────────────────────────────────────────────────┤
│ ✓ dialog.showOpenDialog()     (File System Access) │
│ ✓ dialog.showSaveDialog()      (File System Access)│
│ ✓ Notification (browser)       (Web Notifications) │
│ ✓ clipboard (browser)          (Clipboard API)     │
│ ✓ shell.openExternal()         (window.open)       │
│ ✓ File reading/writing         (FileHandle API)    │
└─────────────────────────────────────────────────────┘
                        │
                        │ WebSocket IPC
                        ▼
┌─────────────────────────────────────────────────────┐
│ SERVER-SIDE (Node.js APIs)                          │
├─────────────────────────────────────────────────────┤
│ ✓ fs.readFile/writeFile        (Server files)      │
│ ✓ app.getPath()                 (Server paths)      │
│ ✓ shell.openPath()              (Server folders)    │
│ ✓ Database operations           (Server-side DB)    │
│ ✓ Child processes               (Server processes)  │
└─────────────────────────────────────────────────────┘
```

**Example - WRONG**:
```javascript
// ❌ DON'T send dialog operations to server
ipcMain.handle('dialog:openFile', async () => {
  return await dialog.showOpenDialog(); // Server has no UI!
});
```

**Example - CORRECT**:
```javascript
// ✓ Handle dialogs on client side
import { dialog } from 'electron-to-web/renderer';

window.api = {
  openFile: async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    return result;
  }
};
```

---

## IPC and Communication

### ❌ Pitfall 2: IPC Calls Never Resolve

**Problem**: Calling `ipcRenderer.invoke()` but the Promise never resolves or rejects.

**Symptoms**:
- Buttons don't work after clicking
- Console shows Promises stuck in "pending" state
- No errors in console

**Root causes**:
1. **WebSocket not connected** - Check if `[IPCRenderer] WebSocket connected` appears in console
2. **Server not running** - Verify server is listening on correct port
3. **Handler not registered** - Server must have matching `ipcMain.handle()` for each invoke

**Solution**:
```javascript
// 1. Verify WebSocket connection
console.log('[IPCRenderer] Connecting to:', wsUrl);
// Should see: [IPCRenderer] WebSocket connected

// 2. Check server logs for handler registration
// Should see: [IPC] Registered handler: your-channel-name

// 3. Verify handler exists on server
ipcMain.handle('your-channel-name', async (event, ...args) => {
  return { success: true, data: 'response' };
});

// 4. Enable debug mode to see requests
if (process.env.NODE_ENV === 'development') {
  ipcRenderer.enableDebug?.();
}
```

---

## Dialog and File System

### ❌ Pitfall 3: Dialog Returns File Paths, But Files Can't Be Accessed

**Problem**: Using File System Access API dialogs which return file **names** (not full paths), then trying to read files by path on the server.

**Why it fails**: Browser File System Access API gives you file **handles**, not paths. The server can't access files selected by the client.

**Solution**: Read files on the client, send content to server:

```javascript
// ✓ CORRECT: Client-side file reading
import { dialog } from 'electron-to-web/renderer';

const fileHandles = new Map();

async function openFileDialog() {
  // Show picker and get handles
  const handles = await window.showOpenFilePicker({
    types: [{ accept: { '*/*': ['.json'] } }],
    multiple: true
  });

  // Store handles and return names
  const fileNames = await Promise.all(
    handles.map(async (handle) => {
      const file = await handle.getFile();
      fileHandles.set(file.name, handle);
      return file.name;
    })
  );

  return { success: true, filePaths: fileNames };
}

async function importFile(fileName) {
  // Read from stored handle
  const handle = fileHandles.get(fileName);
  const file = await handle.getFile();
  const content = await file.text();

  // Send content to server for processing
  return await ipcRenderer.invoke('process-file', {
    name: fileName,
    content: content
  });
}
```

### ❌ Pitfall 4: File Export Not Working

**Problem**: Trying to write files from server to client-selected location.

**Solution**: Write files on client using FileHandle:

```javascript
async function saveFileDialog(defaultName) {
  const handle = await window.showSaveFilePicker({
    suggestedName: defaultName,
    types: [{ accept: { '*/*': ['.json'] } }]
  });

  return { handle, fileName: (await handle.getFile()).name };
}

async function exportFile(fileName, data) {
  const handle = fileHandles.get(fileName);
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();

  return { success: true };
}
```

---

## Build Configuration

### ❌ Pitfall 5: Module Resolution Errors in Browser

**Problem**: Browser can't resolve npm packages like `json-rpc-2.0` or `electron-to-web/renderer`.

**Symptoms**:
```
Failed to resolve module specifier "json-rpc-2.0".
Relative references must start with either "/", "./", or "../".
```

**Why it fails**: Browsers don't understand Node.js module resolution (node_modules).

**Solution**: Use a bundler (Vite, Webpack, etc.) to bundle dependencies:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'web-dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preload: resolve(__dirname, 'preload.web.js') // Bundle preload!
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Don't hash preload filename
          if (chunkInfo.name === 'preload') {
            return 'preload.js';
          }
          return '[name]-[hash].js';
        }
      }
    }
  },
  resolve: {
    alias: {
      // Alias to local build
      'electron-to-web/renderer': resolve(__dirname, '../../dist/renderer/index.js')
    }
  }
});
```

### ❌ Pitfall 6: Files Deleted on Every Build

**Problem**: Vite's `emptyOutDir: true` deletes everything, including files you need to copy.

**Solution**: Either:

**Option A** - Copy files after build:
```json
// package.json
{
  "scripts": {
    "build:web": "vite build && npm run copy-files",
    "copy-files": "cp renderer.js web-dist/ && cp renderer-wrapper.js web-dist/"
  }
}
```

**Option B** - Keep files outside build dir and serve both:
```javascript
// server.js
app.use(express.static('web-dist'));      // Built files
app.use(express.static('public'));        // Static files (not built)
```

**Option C** - Include in Vite build:
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        preload: 'preload.web.js',
        renderer: 'renderer.js',           // Include renderer
        wrapper: 'renderer-wrapper.js'     // Include wrapper
      }
    }
  }
});
```

### ❌ Pitfall 7: Wrong HTML File Name

**Problem**: Vite outputs `index.html` but you named it `index.web.html`.

**Symptoms**:
```
GET http://localhost:3002/ 404 (Not Found)
```

**Solution**: Either rename after build or configure Vite:

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.web.html')
      }
    }
  }
});

// Then rename in build script
// package.json
{
  "scripts": {
    "build:web": "vite build && cd web-dist && mv index.web.html index.html"
  }
}
```

---

## Browser Compatibility

### ❌ Pitfall 8: File System Access API Not Supported

**Problem**: File System Access API only works in Chrome/Edge.

**Solution**: Provide fallback:

```javascript
async function showOpenDialog(options) {
  // Try modern API
  if ('showOpenFilePicker' in window) {
    return await showOpenDialogModern(options);
  }

  // Fallback to file input
  return await showOpenDialogFallback(options);
}

function showOpenDialogFallback(options) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.properties?.includes('multiSelections');

    if (options.filters) {
      input.accept = options.filters
        .flatMap(f => f.extensions.map(ext => `.${ext}`))
        .join(',');
    }

    input.onchange = () => {
      const files = Array.from(input.files || []);
      resolve({
        canceled: files.length === 0,
        files: files  // Return File objects, not paths
      });
    };

    input.click();
  });
}
```

### ❌ Pitfall 9: Notifications Don't Show

**Problem**: Browser notifications require permission.

**Solution**: Request permission first:

```javascript
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}

async function showNotification(title, body) {
  const hasPermission = await requestNotificationPermission();

  if (hasPermission) {
    new Notification(title, { body });
  } else {
    // Fallback to toast/banner in UI
    console.log(`[Notification] ${title}: ${body}`);
  }
}
```

### ❌ Pitfall 10: CORS Issues with WebSocket

**Problem**: WebSocket connection blocked by CORS when developing locally.

**Solution**: Enable CORS on server:

```javascript
import { createWebServer } from 'electron-to-web/server';

const { app } = createWebServer({
  port: 3000,
  cors: true  // Enable CORS for development
});

// Or configure manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
```

---

## Quick Checklist

Before deploying, verify:

- [ ] IPC calls resolve (not stuck in pending)
- [ ] WebSocket connects successfully
- [ ] Dialog operations run on client (not server)
- [ ] Files are read/written using FileHandles (not paths)
- [ ] Preload script is bundled with dependencies
- [ ] HTML file is named correctly (index.html)
- [ ] Notification permission requested
- [ ] File System Access API has fallback
- [ ] Build script copies/preserves necessary files
- [ ] CORS enabled for development

---

## Getting Help

If you encounter issues not covered here:

1. Check browser console for errors
2. Check server logs for IPC messages
3. Enable debug mode: Search for `.enableDebug()` in docs
4. Open an issue: https://github.com/anthropics/electron-to-web/issues

---

**Related Guides:**
- [Migration Guide](./MIGRATION_GUIDE.md) - Step-by-step migration
- [Build Configuration](./BUILD_CONFIGURATION.md) - Detailed build setup
- [API Reference](./docs/api/) - Full API documentation
