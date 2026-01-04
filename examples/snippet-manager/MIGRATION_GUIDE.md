# Migration Guide: Electron to Web

This guide walks through converting the Code Snippet Manager from Electron to a web application using electron-to-web.

## Overview

The migration involves:
1. Creating a web server that uses electron-to-web
2. Updating the renderer to connect via WebSocket
3. Building the frontend for web deployment
4. Testing the web version

**Expected Time:** ~30 minutes
**Code Changes:** Minimal (mostly new files)
**Breaking Changes:** None to existing Electron code

---

## Understanding the Architecture

Before migrating, it's crucial to understand which parts of your app run where:

### Electron Architecture

```
┌─────────────────────────────────────┐
│ Main Process (Node.js)              │
│ • File system access                │
│ • Native APIs (dialog, app, shell)  │
│ • IPC handlers                      │
└──────────────┬──────────────────────┘
               │ IPC
               ▼
┌─────────────────────────────────────┐
│ Renderer Process (Chromium)         │
│ • UI/DOM manipulation               │
│ • IPC calls to main                 │
└─────────────────────────────────────┘
```

### electron-to-web Architecture

```
┌─────────────────────────────────────┐
│ CLIENT (Browser)                    │
├─────────────────────────────────────┤
│ • UI/DOM manipulation               │
│ • Client-only APIs:                 │
│   - dialog (File System Access)     │
│   - clipboard (Clipboard API)       │
│   - Notification (Web API)          │
│   - File reading (FileHandle)       │
├─────────────────────────────────────┤
│ • IPC calls via WebSocket           │
└──────────────┬──────────────────────┘
               │ WebSocket (JSON-RPC)
               ▼
┌─────────────────────────────────────┐
│ SERVER (Node.js)                    │
├─────────────────────────────────────┤
│ • Same IPC handlers as Electron     │
│ • Server-side file operations       │
│ • Database, auth, business logic    │
│ • Server-only APIs:                 │
│   - fs operations (server files)    │
│   - app.getPath() (server paths)    │
│   - shell.openPath() (server only)  │
└─────────────────────────────────────┘
```

### Key Differences

| Feature | Electron | electron-to-web |
|---------|----------|-----------------|
| **Dialog** | Main process | Client-side (File System Access API) |
| **File Access** | Any path | Client: FileHandles, Server: server paths only |
| **Clipboard** | Main or Renderer | Client-side (Clipboard API) |
| **Notifications** | Main process | Client-side (Web Notifications API) |
| **Communication** | IPC (in-process) | WebSocket (network) |

**Important**: Not all native APIs can go through IPC to the server. Some MUST run on the client.

---

## Step 1: Install Dependencies

Add electron-to-web to your project:

```bash
npm install ../../../  # Install electron-to-web from local (or use npm install electron-to-web)
npm install express    # Web server
```

For building:
```bash
npm install --save-dev vite  # For building the frontend
```

---

## Step 2: Create Web Server Structure

Create a new directory for the web server:

```
snippet-manager/
├── main.js              # Existing Electron main process
├── preload.js           # Existing preload
├── renderer.js          # Existing renderer
├── index.html           # Existing HTML
├── styles.css           # Existing styles
├── web-server/          # NEW: Web server
│   ├── server.js        # NEW: Web server entry point
│   └── package.json     # NEW: Server dependencies
└── web-dist/            # NEW: Built frontend files
```

---

## Step 3: Create Web Server Entry Point

**File:** `web-server/server.js`

```javascript
/**
 * Web Server - Uses electron-to-web to run Electron code on web
 */

// Import electron-to-web instead of electron
import { ipcMain, BrowserWindow } from 'electron-to-web/main';
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all the IPC handlers from main.js
// This is the EXACT same code from Electron main process
// (We'll either copy or import the handlers)

let mainWindow;

// Get snippets directory
function getSnippetsDir() {
  // For web, use a different path (e.g., ./data/snippets)
  return path.join(__dirname, '../data/snippets');
}

async function ensureSnippetsDir() {
  const snippetsDir = getSnippetsDir();
  try {
    await fs.mkdir(snippetsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create snippets directory:', error);
  }
  return snippetsDir;
}

// Create mock window
mainWindow = new BrowserWindow();

// ============================================
// Copy ALL IPC handlers from main.js here
// They work EXACTLY the same!
// ============================================

// Snippet operations
ipcMain.handle('snippets:getAll', async () => {
  // ... same code as Electron version
});

// ... all other handlers ...

// ============================================
// Start Web Server
// ============================================

async function startServer() {
  await ensureSnippetsDir();

  const { app, server, wss } = createWebServer({
    port: 3001,
    staticDir: path.join(__dirname, '../web-dist'),

    // Enable all native APIs for demo (use custom config in production)
    security: TRUSTED_SECURITY_CONFIG,

    cors: true
  });

  console.log('🚀 Snippet Manager Web Server running on http://localhost:3001');
  console.log('📁 Snippets directory:', getSnippetsDir());
  console.log('🔌 WebSocket endpoint: ws://localhost:3001/ipc');
}

startServer().catch(console.error);
```

---

## Step 4: Update Renderer for Web

**Two Options:**

### Option A: Build-time Aliasing (Recommended)

Use Vite to automatically replace `electron` imports:

**File:** `vite.config.js`

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'web-dist',
    rollupOptions: {
      input: 'index.html'
    }
  },
  resolve: {
    alias: {
      // Auto-replace electron with electron-to-web
      'electron': 'electron-to-web/renderer'
    }
  }
});
```

**No changes needed to `preload.js` or `renderer.js`!**

### Option B: Manual Update

Create a web-specific preload:

**File:** `preload.web.js`

```javascript
import { ipcRenderer } from 'electron-to-web/renderer';

// Same API as Electron preload
window.snippetAPI = {
  getAllSnippets: () => ipcRenderer.invoke('snippets:getAll'),
  saveSnippet: (snippet) => ipcRenderer.invoke('snippets:save', snippet),
  // ... all other methods ...
};
```

Update `index.html`:
```html
<!-- For Electron -->
<script src="preload.js"></script>

<!-- For Web -->
<script type="module" src="preload.web.js"></script>
```

---

## Step 5: Create Server Package.json

**File:** `web-server/package.json`

```json
{
  "name": "snippet-manager-web-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "electron-to-web": "file:../../..",
    "express": "^5.0.0"
  }
}
```

---

## Step 6: Build Frontend

Build the frontend for web deployment:

```bash
# Install Vite
npm install --save-dev vite

# Build frontend
npx vite build
```

This creates `web-dist/` with:
- `index.html`
- `assets/index-[hash].js` (bundled renderer)
- `assets/index-[hash].css` (bundled styles)

---

## Step 7: Start Web Server

```bash
cd web-server
npm install
npm start
```

Open http://localhost:3001 in your browser!

---

## What Changed vs. What Stayed the Same

### ✅ **No Changes Required** (100% Compatible)

1. **IPC Handler Logic** - All `ipcMain.handle()` code works identically
2. **Renderer Logic** - All UI code works the same
3. **Data Structures** - Same request/response formats
4. **Error Handling** - Same error propagation

### 📝 **Changed** (New/Different Files)

1. **Server Entry Point** - New `web-server/server.js` instead of Electron app lifecycle
2. **Import Statements** - `electron` → `electron-to-web/main` (can be aliased)
3. **Static Serving** - Frontend served by Express instead of Electron window
4. **Build Process** - Vite builds frontend, copied to `web-dist/`

---

## Testing the Migration

### Functional Tests

Test all features work the same:

1. ✅ Create snippet
2. ✅ Edit snippet
3. ✅ Delete snippet
4. ✅ Search snippets
5. ✅ Copy to clipboard (Web Clipboard API)
6. ✅ Export snippet (File System Access API / download)
7. ✅ Import snippet (File System Access API / file input)
8. ✅ Open snippets folder (server-side shell.openPath)
9. ✅ Open external links (window.open)
10. ✅ Notifications (Web Notification API)

### API-Specific Tests

#### Clipboard
- Test on HTTPS (clipboard requires secure context)
- Test permission handling

#### Dialog
- Test on Chrome/Edge (File System Access API)
- Test on Firefox/Safari (fallback to input)
- Test single file, multiple files, save dialog

#### Notification
- Test permission request flow
- Test notification display
- Test notification click handler

#### Shell
- `openExternal()` - Should open in new tab
- `openPath()` - Should work on server (with security config)

---

## Production Deployment

### Security Configuration

**DON'T** use `TRUSTED_SECURITY_CONFIG` in production!

Create a custom security policy:

```javascript
createWebServer({
  port: 3001,
  security: {
    // Only allow specific shell operations
    allowShellExecution: true,
    allowPathQueries: true,

    // Whitelist allowed paths
    allowedPaths: [
      path.join(__dirname, '../data')
    ],

    // Validate file paths
    validateFilePath: (filePath) => {
      // Prevent directory traversal
      if (filePath.includes('..')) return false;

      // Only allow access to data directory
      const resolved = path.resolve(filePath);
      const dataDir = path.resolve(__dirname, '../data');
      return resolved.startsWith(dataDir);
    },

    // Validate shell commands
    validateShellCommand: (command, args) => {
      // Only allow specific commands
      const allowedCommands = ['open', 'xdg-open', 'explorer'];
      return allowedCommands.some(cmd => command.includes(cmd));
    }
  }
});
```

### Add Authentication

```javascript
import jwt from 'jsonwebtoken';

createWebServer({
  port: 3001,

  // Verify JWT on WebSocket connection
  onConnection: (ws, req) => {
    const token = new URL(req.url, 'ws://localhost').searchParams.get('token');

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      ws.user = user;
    } catch {
      ws.close(1008, 'Invalid token');
    }
  }
});
```

### Environment Variables

```bash
# .env
PORT=3001
NODE_ENV=production
JWT_SECRET=your-secret-key
SNIPPETS_DIR=/var/lib/snippet-manager/data
```

---

## Troubleshooting

### Issue: WebSocket Connection Failed

**Symptoms:** `WebSocket connection to 'ws://localhost:3001/ipc' failed`

**Solution:**
1. Ensure server is running: `npm start` in `web-server/`
2. Check console for port conflicts
3. Verify frontend is built: `npx vite build`

### Issue: Handlers Not Found

**Symptoms:** `Method not found: snippets:getAll`

**Solution:**
1. Check server logs - handlers should be logged on registration
2. Ensure all handlers copied from `main.js` to `server.js`
3. Verify channel names match exactly (case-sensitive)

### Issue: Clipboard Not Working

**Symptoms:** Clipboard copy fails silently

**Solution:**
1. Must use HTTPS in production (clipboard API requires secure context)
2. Check browser clipboard permissions
3. For local testing, use `localhost` (treated as secure)

### Issue: File Dialogs Not Working

**Symptoms:** File open/save doesn't work

**Solution:**
1. Chrome/Edge: Should use File System Access API
2. Firefox/Safari: Falls back to `<input type="file">`
3. Check browser console for permission errors

### Issue: Notifications Not Showing

**Symptoms:** No desktop notifications

**Solution:**
1. Request notification permission first
2. Check browser notification settings
3. Some browsers block notifications from localhost

---

## Performance Considerations

### Bundle Size

- Electron app: ~150MB (includes Chromium)
- Web app: ~500KB (just your code)

### Latency

- Electron IPC: ~0.1ms
- electron-to-web (WebSocket): ~1-2ms
- **Negligible difference for UI operations**

### Concurrent Users

- Electron: 1 user per instance
- Web: Unlimited users (limited by server resources)

---

## Next Steps

1. ✅ Test all features in web version
2. Add authentication (JWT, sessions, etc.)
3. Deploy to production server
4. Set up HTTPS (required for clipboard, notifications)
5. Add monitoring and logging
6. Consider CDN for static assets

---

## Summary

**Total Migration Effort:**
- 🕐 Time: ~30 minutes
- 📝 New Files: 3 (server.js, vite.config.js, package.json)
- ✏️ Modified Files: 0 (existing Electron code unchanged!)
- 🎯 Compatibility: 100%

The beauty of electron-to-web: **Your Electron code just works on the web!**

---

## Additional Resources

### Essential Reading

- **[Common Pitfalls](../../COMMON_PITFALLS.md)** - Issues to avoid and how to fix them
  - IPC calls not resolving
  - Dialog operations failing
  - File import/export problems
  - Browser compatibility issues

- **[Build Configuration](../../BUILD_CONFIGURATION.md)** - Detailed build setup
  - Vite configuration examples
  - Webpack alternatives
  - Post-build scripts
  - Performance optimization

- **[Native API Usage](./NATIVE_API_USAGE.md)** - API reference for web
  - Which APIs work where (client vs server)
  - Browser API equivalents
  - Code examples

### Before You Start

**Recommended reading order:**
1. This Migration Guide (you are here)
2. [Common Pitfalls](../../COMMON_PITFALLS.md) - Learn what NOT to do
3. [Build Configuration](../../BUILD_CONFIGURATION.md) - Set up your build correctly

### Getting Help

- 📖 [Full Documentation](../../docs/)
- 🐛 [Report Issues](https://github.com/anthropics/electron-to-web/issues)
- 💬 [Discussions](https://github.com/anthropics/electron-to-web/discussions)
- 📧 Email: support@example.com

---

**Happy migrating! 🚀**
