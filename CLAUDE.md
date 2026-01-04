# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**electron-to-web** is a library that enables Electron apps to run in the browser by providing drop-in replacements for Electron's IPC system. It uses JSON-RPC 2.0 over WebSocket to replicate Electron's IPC APIs (`ipcMain`, `ipcRenderer`, `BrowserWindow.webContents`) without requiring code changes.

## Development Commands

### Build & Development
```bash
npm run build          # Compile TypeScript to dist/
npm run watch          # Watch mode for development
npm run clean          # Remove dist/ directory
```

### Testing
```bash
npm test               # Run all E2E tests (builds first, then runs tests)
npm run test:e2e       # Same as npm test
npm run test:mocha     # Run mocha tests directly
npm run test:watch     # Run tests in watch mode
```

The test suite:
- Builds the project before running
- Runs E2E tests that spin up a WebSocket server and multiple clients
- Tests all IPC features (invoke, send, on, broadcast, etc.)
- Generates a detailed test report with feature coverage

## Architecture

### Three-Module System

The library exports three separate modules via package.json exports:

1. **`electron-to-web/main`** - Server-side (replaces Electron main process)
   - `ipcMain` - Handles IPC requests from clients
   - `BrowserWindow` - Provides `webContents.send()` for broadcasting
   - Native API shims (app, shell, dialog, clipboard, etc.)

2. **`electron-to-web/renderer`** - Client-side (replaces Electron renderer)
   - `ipcRenderer` - Makes IPC requests to server
   - Native API shims using Web APIs (clipboard, dialog, Notification, screen, shell)

3. **`electron-to-web/server`** - Server utilities
   - `createWebServer()` - Creates Express + WebSocket server
   - Security configuration (TRUSTED_SECURITY_CONFIG, etc.)

### Source Structure

```
src/
├── main/               # Server-side implementations
│   ├── ipc-main.ts     # Core IPC handler (wraps json-rpc-2.0 server)
│   ├── browser-window.ts  # BrowserWindow shim
│   ├── native-handlers.ts # Registers server-side native API handlers
│   └── app.ts, shell.ts, dialog.ts, etc. # Native API implementations
├── renderer/           # Client-side implementations
│   ├── ipc-renderer.ts # Core IPC client (wraps json-rpc-2.0 client)
│   └── clipboard.ts, dialog.ts, etc. # Native API implementations using Web APIs
├── server/
│   └── create-server.ts  # Express + WebSocket server factory
└── shared/
    ├── types.ts        # Shared TypeScript types
    └── security-config.ts  # Security configuration types
```

### Key Design Patterns

**JSON-RPC Mapping:**
- `ipcRenderer.invoke(channel, ...args)` → JSON-RPC request with method=channel
- `ipcMain.handle(channel, handler)` → JSON-RPC method handler
- `webContents.send(channel, ...args)` → JSON-RPC notification (broadcast to all clients)
- `ipcRenderer.on(channel, handler)` → Listen for JSON-RPC notifications

**Client Tracking:**
- Server tracks all connected WebSocket clients in `ipcMain.clients` Map
- Each client gets unique ID: `client-${timestamp}-${counter}`
- Mock Electron event objects include `sender.id` for client identification

**Connection Management:**
- IPCRenderer auto-reconnects with exponential backoff (1s, 2s, 4s... up to 30s max)
- Messages sent while disconnected are queued and flushed on reconnection
- Max 10 reconnection attempts before giving up

**Native APIs:**
- Client-side native APIs use pure Web APIs (no server required)
- Server-side native APIs require explicit security configuration
- All operations disabled by default for security
- Use `TRUSTED_SECURITY_CONFIG` to enable all operations (trusted environments only)

## TypeScript Configuration

- **Target:** ES2020 (modern Node.js + browsers)
- **Module:** ES2020 (native ESM, not CommonJS)
- **Strict mode:** Enabled (strict type checking)
- **Output:** `dist/` with source maps and declaration files
- **Include:** All `.ts` files in `src/`
- **Exclude:** `node_modules`, `dist`, `examples`, `tests`

## Testing Architecture

Tests are E2E integration tests that:
1. Build the project (`npm run build`)
2. Start a WebSocket server using `test-server.mjs`
3. Create multiple IPCRenderer clients
4. Test all IPC patterns (invoke, send, on, broadcast, errors)
5. Generate feature coverage report

The test suite validates:
- Request/response (invoke/handle)
- One-way messages (send/on)
- Event broadcasting (webContents.send)
- Multi-client support
- Error handling and propagation
- Connection lifecycle (reconnection, queuing)
- Data type serialization

## Security Model

**Server-side native operations require explicit opt-in:**

```typescript
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';

// All operations disabled by default
createWebServer({ port: 3001 });

// Enable all operations (trusted environments only)
createWebServer({
  port: 3001,
  security: TRUSTED_SECURITY_CONFIG
});

// Custom security policy
createWebServer({
  port: 3001,
  security: {
    allowShellExecution: true,
    allowedPaths: ['/home/user/projects'],
    validateFilePath: (path) => !path.includes('..')
  }
});
```

**Operations requiring security config:**
- `shell.openPath()`, `shell.showItemInFolder()`, `shell.trashItem()`
- `app.getPath()` (path queries)
- Future: file system operations

**Client-side operations (no security config needed):**
- `clipboard` - Uses `navigator.clipboard`
- `dialog` - Uses File System Access API + fallback
- `Notification` - Uses Web Notification API
- `screen` - Uses `window.screen`
- `shell.openExternal()` - Uses `window.open()`
- `shell.beep()` - Uses Web Audio API

## Common Patterns

### Adding a New IPC Handler
1. Server: Register handler with `ipcMain.handle(channel, handler)`
2. Handler receives `(event, ...args)` - event has `sender.id` for client ID
3. Return value is sent as JSON-RPC response
4. Thrown errors are serialized as JSON-RPC errors

### Adding a New Native API
1. For client-side (browser): Add to `src/renderer/` using Web APIs
2. For server-side: Add to `src/main/` and register in `native-handlers.ts`
3. Server-side APIs must check security config before executing
4. Update types in `src/shared/types.ts` if needed

### Broadcasting Events
```typescript
// Server
const mainWindow = new BrowserWindow();
mainWindow.webContents.send('event:name', data);  // Broadcast to all clients

// Or send to specific client
mainWindow.webContents.sendTo(clientId, 'event:name', data);
```

## Important Implementation Details

**WebSocket Connection:**
- Client auto-connects to `ws://${window.location.host}${wsPath}`
- Default wsPath is `/ipc`
- Protocol auto-upgrades to `wss:` for HTTPS pages

**Event Object Mock:**
- Server creates mock Electron event: `{ sender: { id: clientId } }`
- Handlers can access client ID via `event.sender.id`
- Use `ipcMain.getClient(clientId)` to get WebSocket instance

**Message Queueing:**
- IPCRenderer queues messages when WebSocket is disconnected
- Queue is flushed when connection reopens
- No message loss during brief disconnections

**Error Propagation:**
- Server handler errors → JSON-RPC error codes (-32603 for internal errors)
- Client promise rejects with Error object
- Error messages preserved across JSON-RPC boundary

## Publishing

### Automated Release Process (CI/CD)

Publishing is **fully automated** via GitHub Actions. The workflow triggers on git tags:

**To publish a new version:**

1. **Update version in package.json**
   ```bash
   # Edit package.json and change "version": "0.x.x"
   ```

2. **Commit the version bump**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 0.x.x"
   ```

3. **Create and push annotated tag**
   ```bash
   git tag -a v0.x.x -m "Release v0.x.x

   🐛 Bug Fixes:
   - Description of fixes

   ✨ Features:
   - Description of new features

   📚 Documentation:
   - Documentation updates"

   git push origin main
   git push origin v0.x.x
   ```

4. **CI/CD automatically:**
   - Runs all tests
   - Builds the project
   - Publishes to npm (using OIDC trusted publishing)
   - Creates GitHub release with notes

**Workflow file:** `.github/workflows/release.yml`

**Requirements:**
- Tag must match pattern `v*.*.*` (e.g., `v0.2.0`)
- Tag must be annotated (`-a` flag)
- npm publishing uses OIDC (no manual token needed)

**Versioning:**
- Follows semver (MAJOR.MINOR.PATCH)
- Bug fixes → PATCH (0.1.4 → 0.1.5)
- New features → MINOR (0.1.x → 0.2.0)
- Breaking changes → MAJOR (0.x.x → 1.0.0)

**Package contents:**
- `files`: Only `dist/`, README, docs, LICENSE
- `main`: Points to `dist/main/index.js`
- `types`: Points to `dist/main/index.d.ts`
- `exports`: Three entry points (main, renderer, server)
