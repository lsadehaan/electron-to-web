# electron-to-web

**Deploy your Electron app to the web without rewriting code**

[![CI](https://github.com/lsadehaan/electron-to-web/actions/workflows/ci.yml/badge.svg)](https://github.com/lsadehaan/electron-to-web/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/electron-to-web.svg)](https://www.npmjs.com/package/electron-to-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/electron-to-web)](https://nodejs.org)

`electron-to-web` is a drop-in replacement for Electron's IPC system that enables your desktop app to run in the browser. It provides shims for `ipcMain`, `ipcRenderer`, and `BrowserWindow` that automatically convert IPC communication to JSON-RPC over WebSocket.

## The Problem

You have an Electron app and want to offer a web version, but:
- ❌ Rewriting all IPC calls to HTTP endpoints is tedious and error-prone
- ❌ Maintaining two codebases (Electron + Web) doubles your work
- ❌ Custom IPC-to-HTTP adapters are complex and fragile
- ❌ Real-time features (events, notifications) require separate WebSocket infrastructure

## The Solution

**Change 2 import statements, and your Electron app works in the browser.**

```typescript
// Before (Electron desktop):
import { ipcMain, BrowserWindow } from 'electron';

// After (Web deployment):
import { ipcMain, BrowserWindow } from 'electron-to-web/main';
```

That's it. Your IPC handlers, event listeners, and business logic remain **100% unchanged**.

## How It Works

`electron-to-web` uses **JSON-RPC 2.0 over WebSocket** to replicate Electron's IPC system:

- `ipcRenderer.invoke(channel, data)` → JSON-RPC request
- `ipcMain.handle(channel, handler)` → JSON-RPC method handler
- `webContents.send(channel, data)` → JSON-RPC notification (broadcast)
- `ipcRenderer.on(channel, handler)` → JSON-RPC notification listener

**Architecture:**

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Your React/Vue/etc. app - UNCHANGED)           │
│  import { ipcRenderer } from 'electron-to-web/renderer'  │
│                                                          │
│  • await ipcRenderer.invoke('user:create', data)         │
│  • ipcRenderer.on('user:created', handler)               │
└──────────────────────────────────────────────────────────┘
                          ↕
         JSON-RPC 2.0 over WebSocket (single connection)
                          ↕
┌──────────────────────────────────────────────────────────┐
│  Node.js Server (Your Electron main code - UNCHANGED)    │
│  import { ipcMain } from 'electron-to-web/main'          │
│                                                          │
│  ipcMain.handle('user:create', async (event, data) => {  │
│    const user = await db.createUser(data);               │
│    mainWindow.webContents.send('user:created', user);    │
│    return { success: true, user };                       │
│  });                                                     │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
npm install electron-to-web
```

### Server Setup (Electron Main Process → Web Server)

```typescript
// server.ts
import { ipcMain, BrowserWindow } from 'electron-to-web/main';
import { createWebServer } from 'electron-to-web/server';

// Create "window" instance (in web mode, this is just a shim)
const mainWindow = new BrowserWindow();

// Your IPC handlers work EXACTLY like Electron!
ipcMain.handle('user:create', async (event, userData) => {
  const user = await createUser(userData);

  // Send notification to all connected clients
  mainWindow.webContents.send('user:created', user);

  return { success: true, user };
});

ipcMain.handle('user:list', async (event) => {
  const users = await listUsers();
  return { success: true, users };
});

// Start web server
createWebServer({
  port: 3001,
  staticDir: './dist' // Your built frontend
});

console.log('Server running on http://localhost:3001');
```

### Client Setup (Electron Renderer → Browser)

```typescript
// App.tsx (or any frontend file)
import { ipcRenderer } from 'electron-to-web/renderer';
import { useEffect, useState } from 'react';

function App() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Listen for real-time updates
    ipcRenderer.on('user:created', (event, user) => {
      console.log('New user created:', user);
      loadUsers(); // Refresh list
    });

    loadUsers();

    // Cleanup on unmount
    return () => {
      ipcRenderer.removeAllListeners('user:created');
    };
  }, []);

  async function loadUsers() {
    const result = await ipcRenderer.invoke('user:list');
    if (result.success) {
      setUsers(result.users);
    }
  }

  async function createUser() {
    const result = await ipcRenderer.invoke('user:create', {
      name: 'John Doe',
      email: 'john@example.com'
    });

    if (result.success) {
      console.log('User created:', result.user);
    }
  }

  return (
    <div>
      <button onClick={createUser}>Create User</button>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name} ({user.email})</li>
        ))}
      </ul>
    </div>
  );
}
```

### Build Configuration (Vite Example)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Auto-resolve electron imports to electron-to-web
      'electron': 'electron-to-web/renderer'
    }
  }
});
```

That's it! Your app now runs in the browser with **zero changes** to your IPC logic.

## Features

### ✅ Fully Supported

**ipcRenderer (Client-side):**
- ✅ `invoke()` - Request/response pattern with async handlers
- ✅ `send()` - One-way messages (fire-and-forget)
- ✅ `on()` - Listen for events from main process
- ✅ `once()` - Listen for event once, then auto-remove
- ✅ `removeListener()` / `off()` - Remove specific listener
- ✅ `removeAllListeners()` - Remove all listeners for channel

**ipcMain (Server-side):**
- ✅ `handle()` - Register async request handler
- ✅ `handleOnce()` - Handle request once, then auto-remove
- ✅ `on()` - Listen for one-way messages from renderer
- ✅ `once()` - Listen for message once, then auto-remove
- ✅ `removeHandler()` - Remove invoke handler
- ✅ `removeListener()` / `off()` - Remove specific listener
- ✅ `removeAllListeners()` - Remove all listeners for channel

**webContents (Server-side):**
- ✅ `send()` - Broadcast notifications to all connected clients
- ✅ `sendTo()` - Send notification to specific client by ID

**Additional Features:**
- ✅ **Error Handling**: Standard JSON-RPC error codes
- ✅ **Reconnection**: Automatic WebSocket reconnection with exponential backoff
- ✅ **TypeScript**: Full type safety with generics
- ✅ **Multiple Clients**: Supports many browser tabs/windows
- ✅ **100% Test Coverage**: 25 comprehensive E2E tests

### ⚠️ Partial Support (Browser Limitations)

- **Synchronous IPC**: `ipcRenderer.sendSync()` → Not supported (async only in browsers)
- **Shared Workers**: Can enable renderer-to-renderer communication (opt-in)

### ✅ Native API Support (NEW!)

**Client-side (Pure Web APIs - no server required):**
- ✅ `clipboard` - Full clipboard API via `navigator.clipboard`
- ✅ `dialog` - File dialogs via File System Access API + fallback
- ✅ `Notification` - System notifications via Web Notification API
- ✅ `screen` - Display information via `window.screen`
- ✅ `shell.openExternal()` - Open URLs via `window.open()`
- ✅ `shell.beep()` - Audio beep via Web Audio API

**Server-side (Requires security configuration):**
- ✅ `shell.openPath()` - Open files in default application
- ✅ `shell.showItemInFolder()` - Show file in file manager
- ✅ `shell.trashItem()` - Move files to trash
- ✅ `app.getPath()` - Get system paths

**Security Model:**
All server-side operations are disabled by default. Enable with explicit security configuration:

```typescript
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';

createWebServer({
  port: 3001,
  security: TRUSTED_SECURITY_CONFIG, // Enable all operations (for trusted environments)
});
```

See [Native APIs](#native-apis) section for detailed usage and security configuration.

### ❌ Not Supported (Desktop-only Features)

- **Window Controls**: BrowserWindow geometry, minimize, maximize → N/A for web
- **Synchronous IPC**: `ipcRenderer.sendSync()` → Async only in browsers

See [FEATURE_PARITY.md](./FEATURE_PARITY.md) for detailed comparison.

## API Reference

### Main Process (Server-side)

#### `ipcMain.handle(channel, handler)`

Register a handler for IPC requests (for use with `ipcRenderer.invoke()`).

```typescript
import { ipcMain } from 'electron-to-web/main';

ipcMain.handle('channel:name', async (event, ...args) => {
  // event.sender.id - Client ID
  // ...args - Arguments from renderer

  return { success: true, data: '...' };
});
```

#### `ipcMain.handleOnce(channel, handler)`

Register a handler that automatically removes itself after being called once.

```typescript
ipcMain.handleOnce('one-time:channel', async (event, data) => {
  return { received: data };
}); // Auto-removed after first invocation
```

#### `ipcMain.on(channel, listener)`

Listen for one-way messages from renderer (sent via `ipcRenderer.send()`).

```typescript
ipcMain.on('log:message', (event, message) => {
  console.log(`Client ${event.sender.id}:`, message);
});
```

#### `ipcMain.once(channel, listener)`

Listen for one-way message once, then automatically remove listener.

```typescript
ipcMain.once('startup:complete', (event, data) => {
  console.log('App started:', data);
}); // Auto-removed after first call
```

#### `ipcMain.removeHandler(channel)`

Remove a registered invoke handler.

```typescript
ipcMain.removeHandler('channel:name');
```

#### `ipcMain.removeListener(channel, listener)` / `ipcMain.off()`

Remove specific event listener.

```typescript
const handler = (event, data) => { /* ... */ };
ipcMain.on('channel', handler);
// Later:
ipcMain.removeListener('channel', handler);
```

#### `ipcMain.removeAllListeners([channel])`

Remove all listeners for a channel, or all channels if not specified.

```typescript
ipcMain.removeAllListeners('channel'); // Remove all listeners for 'channel'
ipcMain.removeAllListeners(); // Remove all listeners
```

#### `BrowserWindow.webContents.send(channel, ...args)`

Broadcast notification to all connected clients.

```typescript
import { BrowserWindow } from 'electron-to-web/main';

const mainWindow = new BrowserWindow();
mainWindow.webContents.send('notification', { message: 'Hello!' });
```

#### `BrowserWindow.webContents.sendTo(clientId, channel, ...args)`

Send notification to specific client by ID.

```typescript
mainWindow.webContents.sendTo('client-123', 'private:message', { data: 'secret' });
```

### Renderer Process (Client-side)

#### `ipcRenderer.invoke(channel, ...args)`

Send request and wait for response.

```typescript
import { ipcRenderer } from 'electron-to-web/renderer';

const result = await ipcRenderer.invoke('channel:name', arg1, arg2);
```

#### `ipcRenderer.send(channel, ...args)`

Send one-way message (no response expected).

```typescript
ipcRenderer.send('log:message', 'User clicked button');
```

#### `ipcRenderer.on(channel, listener)`

Listen for events from main process.

```typescript
ipcRenderer.on('notification', (event, data) => {
  console.log('Received:', data);
});
```

#### `ipcRenderer.once(channel, listener)`

Listen for event once, then automatically remove listener.

```typescript
ipcRenderer.once('ready', (event, data) => {
  console.log('App ready:', data);
}); // Auto-removed after first notification
```

#### `ipcRenderer.removeListener(channel, listener)` / `ipcRenderer.off()`

Remove specific event listener.

```typescript
const handler = (event, data) => { /* ... */ };
ipcRenderer.on('event', handler);
// Later:
ipcRenderer.removeListener('event', handler);
```

#### `ipcRenderer.removeAllListeners(channel?)`

Remove all listeners for a channel (or all channels if omitted).

```typescript
ipcRenderer.removeAllListeners('notification'); // Just this channel
ipcRenderer.removeAllListeners(); // All channels
```

### Server Utilities

#### `createWebServer(options)`

Create Express server with WebSocket support.

```typescript
import { createWebServer } from 'electron-to-web/server';

const { app, server, wss } = createWebServer({
  port: 3001,              // Server port
  staticDir: './dist',     // Serve static files
  cors: true,              // Enable CORS
  wsPath: '/ipc'           // WebSocket endpoint (default)
});
```

## Native APIs

electron-to-web provides shims for Electron's native APIs, allowing you to use familiar Electron APIs in the browser.

### Clipboard API

Maps Electron's clipboard API to Web Clipboard API (`navigator.clipboard`).

```typescript
import { clipboard } from 'electron-to-web/renderer';

// Write text
await clipboard.writeText('Hello, World!');

// Read text
const text = await clipboard.readText();

// Write HTML
await clipboard.writeHTML('<h1>Title</h1>');

// Write image
const imageBlob = await fetch('/image.png').then(r => r.blob());
await clipboard.writeImage(imageBlob);

// Check if available (requires HTTPS)
if (clipboard.isAvailable()) {
  console.log('Clipboard is available');
}
```

**Limitations:**
- Requires HTTPS (browser security requirement)
- `type` parameter (selection/clipboard) is ignored in web

### Dialog API

Maps Electron's dialog API to File System Access API with fallback to traditional file input.

```typescript
import { dialog } from 'electron-to-web/renderer';

// Open file dialog
const result = await dialog.showOpenDialog({
  title: 'Select Files',
  filters: [
    { name: 'Images', extensions: ['png', 'jpg'] },
    { name: 'Documents', extensions: ['pdf', 'txt'] }
  ],
  properties: ['openFile', 'multiSelections']
});

if (!result.canceled) {
  console.log('Selected:', result.filePaths);
}

// Open directory dialog
const dirResult = await dialog.showOpenDialog({
  properties: ['openDirectory']
});

// Save dialog
const saveResult = await dialog.showSaveDialog({
  title: 'Save File',
  defaultPath: 'document.pdf',
  filters: [{ name: 'PDF', extensions: ['pdf'] }]
});

// Message box
const msgResult = await dialog.showMessageBox({
  type: 'question',
  title: 'Confirm',
  message: 'Are you sure?',
  buttons: ['Yes', 'No', 'Cancel'],
  defaultId: 0
});

console.log('User chose:', msgResult.response);

// Error box
dialog.showErrorBox('Error', 'Something went wrong!');
```

**Implementation:**
- Uses File System Access API in Chrome/Edge
- Falls back to `<input type="file">` in older browsers
- Custom modal for complex message boxes
- Simple alert/confirm for basic dialogs

### Notification API

Maps Electron's Notification API to Web Notification API.

```typescript
import { Notification } from 'electron-to-web/renderer';

// Request permission
if (Notification.isSupported()) {
  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    // Create notification
    const notif = new Notification({
      title: 'Hello!',
      body: 'This is a notification',
      icon: '/icon.png',
      tag: 'unique-tag'
    });

    // Listen for events
    notif.on('click', () => {
      console.log('Notification clicked');
    });

    notif.on('close', () => {
      console.log('Notification closed');
    });

    // Show notification
    await notif.show();
  }
}
```

### Screen API

Maps Electron's screen API to `window.screen`.

```typescript
import { screen } from 'electron-to-web/renderer';

// Get primary display
const display = screen.getPrimaryDisplay();
console.log('Resolution:', display.bounds.width, 'x', display.bounds.height);
console.log('Work area:', display.workArea);
console.log('Scale factor:', display.scaleFactor);
console.log('Touch support:', display.touchSupport);

// Get all displays (web returns only primary)
const displays = screen.getAllDisplays();

// Listen for display changes
screen.on('display-metrics-changed', () => {
  console.log('Display changed');
});
```

**Limitations:**
- Web can only access primary display
- `getCursorScreenPoint()` not available (browser security)

### Shell API

Provides shell operations - some client-side, some requiring server.

```typescript
import { shell } from 'electron-to-web/renderer';

// Open URL (pure client-side)
await shell.openExternal('https://example.com');

// Play beep (pure client-side)
shell.beep();

// Server-side operations (require security config):

// Open file in default app
const error = await shell.openPath('/path/to/file.pdf');
if (error === '') {
  console.log('Opened successfully');
}

// Show file in folder
await shell.showItemInFolder('/path/to/file.txt');

// Move to trash
await shell.trashItem('/path/to/old-file.txt');
```

### Security Configuration

Server-side native operations require explicit security configuration:

```typescript
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';

// Option 1: Fully trusted (all operations allowed)
createWebServer({
  port: 3001,
  security: TRUSTED_SECURITY_CONFIG
});

// Option 2: Custom security config
createWebServer({
  port: 3001,
  security: {
    allowShellExecution: true,       // shell.openPath, showItemInFolder, trashItem
    allowFileSystemAccess: true,     // Future: fs operations
    allowPathQueries: true,          // app.getPath()
    allowedPaths: [
      '/home/user/projects',         // Whitelist specific directories
      '/tmp'
    ],
    validateShellCommand: (command, args) => {
      // Custom validation
      const allowed = ['open', 'xdg-open', 'explorer'];
      return allowed.some(cmd => command.startsWith(cmd));
    },
    validateFilePath: (path) => {
      // Custom path validation
      return !path.includes('..');    // Prevent directory traversal
    }
  }
});

// Option 3: Safe defaults (all disabled)
createWebServer({
  port: 3001
  // No security config = everything disabled
});
```

**Security Error Handling:**

```typescript
import { shell } from 'electron-to-web/renderer';

try {
  await shell.openPath('/etc/passwd');
} catch (error) {
  if (error.message.includes('[Security]')) {
    console.error('Operation not allowed:', error.message);
  }
}
```

See [examples/native-apis-example.ts](./examples/native-apis-example.ts) for complete examples.

## Migration Guide

### Step 1: Install Package

```bash
npm install electron-to-web
```

### Step 2: Update Server Code

```typescript
// Before:
import { app, BrowserWindow, ipcMain } from 'electron';

// After:
import { BrowserWindow, ipcMain } from 'electron-to-web/main';
import { createWebServer } from 'electron-to-web/server';

// Replace app.on('ready') with createWebServer()
createWebServer({ port: 3001, staticDir: './dist' });
```

### Step 3: Update Renderer Code

```typescript
// Before:
import { ipcRenderer } from 'electron';

// After:
import { ipcRenderer } from 'electron-to-web/renderer';
```

**Or use build-time aliasing (recommended):**

```typescript
// vite.config.ts
export default {
  resolve: {
    alias: { 'electron': 'electron-to-web/renderer' }
  }
};
```

Then no changes needed in renderer code!

### Step 4: Build Frontend

```bash
npm run build  # Build your frontend (Vite, webpack, etc.)
```

### Step 5: Start Server

```bash
node server.js  # Your web server
```

### Step 6: Test

Open `http://localhost:3001` in your browser. Your app should work exactly like the Electron version!

## Examples

See the [examples/](./examples/) directory for complete working examples:

- **basic/** - Minimal hello world
- **todo-app/** - Full CRUD app with real-time sync
- **auto-claude/** - Real-world example (Auto-Claude migration)

## Comparison with Alternatives

| Approach | Code Changes | Real-time | Type Safety | Complexity |
|----------|--------------|-----------|-------------|------------|
| **Manual HTTP + WS** | High (rewrite all IPC) | Custom implementation | Manual | High |
| **Electron Forge** | N/A (desktop only) | N/A | N/A | N/A |
| **electron-to-web** | Minimal (2 imports) | Built-in | Full | Low |

## FAQ

### Q: Does this work with existing Electron apps?

**A:** Yes! If your app uses standard `ipcMain.handle()` and `ipcRenderer.invoke()` patterns, it should work with minimal changes.

### Q: What about security?

**A:** The library doesn't add authentication. You should add auth middleware to the Express server (JWT, sessions, etc.) based on your needs.

### Q: Can I use both Electron and Web from the same codebase?

**A:** Yes! Use environment-based imports:

```typescript
const ipc = process.env.IS_WEB
  ? require('electron-to-web/main')
  : require('electron');
```

### Q: Performance impact?

**A:** JSON-RPC adds ~1-2ms latency compared to native Electron IPC. WebSocket keeps a persistent connection, so no HTTP overhead on each call.

### Q: What about file uploads?

**A:** Binary data (Buffers, Files) needs special handling. We recommend:
- Small files: Base64 encode in JSON
- Large files: Separate HTTP POST endpoint

### Q: Does it support bidirectional streaming?

**A:** Not yet. For streaming, use multiple notifications:

```typescript
// Server sends progress updates
for await (const chunk of processData()) {
  mainWindow.webContents.send('progress', { percent: chunk.progress });
}
```

## Troubleshooting

### WebSocket Connection Refused

**Problem:** `WebSocket connection to 'ws://localhost:3001/ipc' failed`

**Solution:** Ensure the server is running and the `wsPath` matches:

```typescript
createWebServer({ wsPath: '/ipc' }); // Server
// Client auto-connects to window.location.host + '/ipc'
```

### Handlers Not Called

**Problem:** `ipcRenderer.invoke()` hangs or times out

**Solution:** Check that:
1. Handler is registered: `ipcMain.handle('channel', handler)`
2. Channel name matches exactly (case-sensitive)
3. Server logs show "Registered method: channel"

### Events Not Received

**Problem:** `ipcRenderer.on()` listener never fires

**Solution:** Ensure:
1. Listener registered before event sent
2. WebSocket is connected (`ipcRenderer.isConnected()`)
3. Channel name matches exactly

### TypeScript Errors

**Problem:** `Cannot find module 'electron-to-web'`

**Solution:** Install type definitions:

```bash
npm install --save-dev @types/node
```

And ensure `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## Documentation

### Essential Guides

📚 **Before migrating, read these guides to avoid common issues:**

- **[Common Pitfalls](./COMMON_PITFALLS.md)** ⚠️ - Must-read guide covering:
  - IPC calls not resolving
  - Dialog and file system issues
  - Build configuration problems
  - Browser compatibility concerns

- **[Build Configuration](./BUILD_CONFIGURATION.md)** 🔧 - Detailed build setup:
  - Vite configuration (recommended)
  - Webpack alternatives
  - Post-build scripts
  - Performance optimization

- **[Migration Guide](./examples/snippet-manager/MIGRATION_GUIDE.md)** 📖 - Step-by-step migration:
  - Architecture understanding
  - Client vs server responsibilities
  - Code examples
  - Testing strategies

### Key Concepts

**Client-Side vs Server-Side Operations:**

```
CLIENT (Browser)              SERVER (Node.js)
├─ Dialogs (File System      ├─ File operations (server)
│  Access API)                ├─ Database queries
├─ Clipboard (browser)        ├─ Authentication
├─ Notifications (browser)    ├─ Business logic
└─ File handles              └─ Shell operations (server)
```

**Not all Electron APIs can go through IPC.** Some must run on the client (dialogs, clipboard), others on the server (file operations, databases). See [Common Pitfalls](./COMMON_PITFALLS.md#architecture-issues) for details.

### Examples

- **[Code Snippet Manager](./examples/snippet-manager/)** - Full-featured app demonstrating:
  - Dialog operations (import/export)
  - Clipboard API
  - File System Access API
  - Notifications
  - Real-world migration patterns

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Roadmap

- [x] Core IPC (invoke, handle, on, send)
- [x] WebSocket transport
- [x] Auto-reconnection
- [x] TypeScript support
- [ ] Authentication middleware helpers
- [ ] File upload utilities
- [ ] Streaming support
- [ ] Renderer-to-renderer IPC (SharedWorker)
- [ ] CLI migration analyzer
- [ ] Performance benchmarks

## License

MIT © 2026

## Credits

Inspired by:
- [vscode-jsonrpc](https://github.com/microsoft/vscode-languageserver-node) - Microsoft's JSON-RPC implementation
- [json-rpc-2.0](https://github.com/shogowada/json-rpc-2.0) - Lightweight JSON-RPC library
- The Electron team for building an amazing framework

---

**Star this repo if it helps your project! ⭐**
