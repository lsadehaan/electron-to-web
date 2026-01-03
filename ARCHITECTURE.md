# Architecture Documentation

**electron-to-web** - Technical Design and Implementation Details

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Architecture Diagram](#architecture-diagram)
4. [Core Components](#core-components)
5. [Message Flow](#message-flow)
6. [Transport Layer](#transport-layer)
7. [Type System](#type-system)
8. [Error Handling](#error-handling)
9. [Connection Management](#connection-management)
10. [Performance Considerations](#performance-considerations)
11. [Security Model](#security-model)
12. [Comparison with Alternatives](#comparison-with-alternatives)

---

## Overview

`electron-to-web` bridges the gap between Electron's IPC system and web-based deployment by providing drop-in replacements for Electron APIs that use JSON-RPC 2.0 over WebSocket as the transport layer.

### Goals

1. **Zero-code migration**: Existing Electron IPC code should work without changes
2. **Type safety**: Full TypeScript support with generics
3. **Performance**: Minimal overhead compared to native Electron IPC
4. **Reliability**: Auto-reconnection, message queuing, error handling
5. **Simplicity**: Small API surface, easy to understand and debug

### Non-Goals

1. **Perfect Electron compatibility**: Desktop-only features (dialogs, shell) are out of scope
2. **Custom protocols**: We use standard JSON-RPC 2.0, not custom formats
3. **Multi-transport**: WebSocket only (no HTTP fallback, SSE, etc.)

---

## Design Principles

### 1. **Minimal Abstraction**

The library provides the thinnest possible layer over JSON-RPC. We don't add custom protocols, headers, or handshakes beyond what JSON-RPC 2.0 specifies.

**Why:** Simplicity makes debugging easier and reduces attack surface.

### 2. **Electron API Compatibility**

The shim APIs exactly match Electron's signatures:

```typescript
// Electron
ipcMain.handle(channel: string, listener: (event, ...args) => Promise<any>)

// electron-to-web (identical)
ipcMain.handle(channel: string, listener: (event, ...args) => Promise<any>)
```

**Why:** Existing code works without modification.

### 3. **Single Connection**

All communication (requests + notifications) uses one WebSocket connection, not separate HTTP + WebSocket channels.

**Why:** Simpler connection management, lower latency, fewer resources.

### 4. **Fail-Fast**

Errors are thrown immediately with clear messages, not silently swallowed.

**Why:** Easier debugging, prevents silent failures in production.

---

## Architecture Diagram

### High-Level Overview

```
┌───────────────────────────────────────────────────────────────┐
│                         Browser Tab                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │   Your App Code (React/Vue/etc.)                        │  │
│  │   - Unchanged from Electron version                     │  │
│  │   - Uses ipcRenderer.invoke(), .on(), .send()          │  │
│  └────────────────┬────────────────────────────────────────┘  │
│                   │                                            │
│                   ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │   electron-to-web/renderer                              │  │
│  │   ┌──────────────┐  ┌──────────────┐                   │  │
│  │   │ IPCRenderer  │  │ JSON-RPC     │                   │  │
│  │   │ Shim         │─▶│ Client       │                   │  │
│  │   └──────────────┘  └──────┬───────┘                   │  │
│  └────────────────────────────┼─────────────────────────────┘  │
└────────────────────────────────┼─────────────────────────────┘
                                 │
                  WebSocket (JSON-RPC 2.0 Messages)
                                 │
┌────────────────────────────────┼─────────────────────────────┐
│                Node.js Server  │                              │
│  ┌────────────────────────────┼─────────────────────────────┐│
│  │   electron-to-web/server   │                             ││
│  │   ┌──────────────┐  ┌──────▼───────┐                    ││
│  │   │ WebSocket    │  │ JSON-RPC     │                    ││
│  │   │ Server       │─▶│ Server       │                    ││
│  │   └──────────────┘  └──────┬───────┘                    ││
│  └────────────────────────────┼──────────────────────────────┘│
│                                │                               │
│                                ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │   electron-to-web/main                                  │  │
│  │   ┌──────────────┐  ┌──────────────┐                   │  │
│  │   │ IPCMain      │  │ BrowserWindow│                   │  │
│  │   │ Shim         │  │ Shim         │                   │  │
│  │   └──────┬───────┘  └──────┬───────┘                   │  │
│  └──────────┼──────────────────┼───────────────────────────┘  │
│             │                  │                               │
│             ▼                  ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │   Your Electron Main Process Code                       │  │
│  │   - Unchanged from desktop version                      │  │
│  │   - Uses ipcMain.handle(), webContents.send()          │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Component Layers

```
Layer 4: Application Code (Unchanged)
         ├─ React/Vue components
         ├─ Electron main process logic
         └─ IPC calls (invoke, on, send)
                    │
                    ▼
Layer 3: Shim Layer (electron-to-web/main & /renderer)
         ├─ IPCMain (server-side)
         ├─ IPCRenderer (client-side)
         └─ BrowserWindow (server-side)
                    │
                    ▼
Layer 2: JSON-RPC Layer (json-rpc-2.0 library)
         ├─ Request/Response handling
         ├─ Notification broadcasting
         ├─ Error serialization
         └─ Message validation
                    │
                    ▼
Layer 1: Transport Layer (WebSocket)
         ├─ Persistent connection
         ├─ Message framing
         ├─ Reconnection logic
         └─ Backpressure handling
```

---

## Core Components

### 1. IPCMain (Server-side)

**File:** `src/main/ipc-main.ts`

**Responsibilities:**
- Register IPC handlers (method name → function)
- Dispatch incoming JSON-RPC requests to handlers
- Create mock Electron `event` objects
- Manage client connections

**Key APIs:**
```typescript
class IPCMain {
  handle(channel: string, handler: Function): void
  removeHandler(channel: string): void
  broadcast(channel: string, ...args: any[]): void
  getClient(clientId: string): WebSocket | undefined
}
```

**Implementation Pattern:**
```typescript
// Wraps json-rpc-2.0 Server
private server = new JSONRPCServer();

handle(channel: string, handler: Function) {
  this.server.addMethod(channel, async (params) => {
    const mockEvent = { sender: { id: 'client-123' } };
    return await handler(mockEvent, ...params);
  });
}
```

### 2. BrowserWindow (Server-side)

**File:** `src/main/browser-window.ts`

**Responsibilities:**
- Provide `webContents.send()` API for broadcasting
- Maintain reference to WebSocket clients
- Support `sendTo()` for targeted messages

**Key APIs:**
```typescript
class BrowserWindow {
  webContents: {
    send(channel: string, ...args: any[]): void
    sendTo(clientId: string, channel: string, ...args: any[]): void
  }
}
```

**Implementation:**
```typescript
webContents.send = (channel, ...args) => {
  ipcMain.broadcast(channel, ...args);
}
```

### 3. IPCRenderer (Client-side)

**File:** `src/renderer/ipc-renderer.ts`

**Responsibilities:**
- Provide `invoke()`, `send()`, `on()` APIs
- Manage WebSocket connection
- Queue messages during disconnection
- Handle auto-reconnection

**Key APIs:**
```typescript
class IPCRenderer {
  invoke<T>(channel: string, ...args: any[]): Promise<T>
  send(channel: string, ...args: any[]): void
  on(channel: string, listener: Function): void
  removeListener(channel: string, listener: Function): void
  removeAllListeners(channel?: string): void
  isConnected(): boolean
}
```

**Implementation Pattern:**
```typescript
// Wraps json-rpc-2.0 Client
private client = new JSONRPCClient((request) => {
  this.ws.send(JSON.stringify(request));
});

async invoke<T>(channel: string, ...args: any[]): Promise<T> {
  return await this.client.request(channel, args);
}
```

### 4. Server Factory

**File:** `src/server/create-server.ts`

**Responsibilities:**
- Create Express HTTP server
- Create WebSocket server
- Wire IPC handlers to WebSocket messages
- Serve static files

**Key APIs:**
```typescript
function createWebServer(options: ServerOptions): {
  app: Express,
  server: http.Server,
  wss: WebSocketServer
}
```

**Implementation:**
```typescript
const wss = new WebSocketServer({ server, path: '/ipc' });

wss.on('connection', (ws) => {
  const clientId = generateClientId();
  ipcMain.addClient(clientId, ws);

  ws.on('message', (data) => {
    ipcMain.handleMessage(ws, data.toString());
  });
});
```

---

## Message Flow

### Request/Response Flow (invoke)

```
1. Browser: ipcRenderer.invoke('user:create', data)
   │
   ▼
2. IPCRenderer creates JSON-RPC request:
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "user:create",
     "params": [data]
   }
   │
   ▼
3. Send over WebSocket
   │
   ▼
4. Server receives message
   │
   ▼
5. IPCMain dispatches to handler:
   ipcMain.handle('user:create', async (event, data) => {...})
   │
   ▼
6. Handler executes, returns result
   │
   ▼
7. IPCMain sends JSON-RPC response:
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": { "success": true, "user": {...} }
   }
   │
   ▼
8. IPCRenderer resolves promise with result
   │
   ▼
9. Application code receives result
```

### Notification Flow (webContents.send)

```
1. Server: mainWindow.webContents.send('user:created', user)
   │
   ▼
2. BrowserWindow creates JSON-RPC notification:
   {
     "jsonrpc": "2.0",
     "method": "user:created",
     "params": [user]
   }
   │
   ▼
3. Broadcast to ALL connected WebSocket clients
   │
   ▼
4. Each browser receives message
   │
   ▼
5. IPCRenderer dispatches to listeners:
   ipcRenderer.on('user:created', (event, user) => {...})
   │
   ▼
6. All registered listeners execute
```

### Error Flow

```
1. Handler throws error:
   throw new Error('User already exists')
   │
   ▼
2. IPCMain catches error, sends JSON-RPC error:
   {
     "jsonrpc": "2.0",
     "id": 1,
     "error": {
       "code": -32603,
       "message": "User already exists"
     }
   }
   │
   ▼
3. IPCRenderer rejects promise
   │
   ▼
4. Application code catches error:
   try {
     await ipcRenderer.invoke('user:create', data);
   } catch (error) {
     console.error(error.message); // "User already exists"
   }
```

---

## Transport Layer

### WebSocket Connection Lifecycle

```
1. Page Load
   └─▶ Create WebSocket: new WebSocket('ws://host/ipc')

2. Connection Opened
   └─▶ Flush queued messages
   └─▶ Emit 'connected' event

3. Message Received
   └─▶ Parse JSON
   └─▶ Is response (has id)? → Resolve promise
   └─▶ Is notification? → Call listeners

4. Connection Closed
   └─▶ Queue new messages
   └─▶ Start reconnection timer (exponential backoff)
   └─▶ Attempt reconnect after delay

5. Reconnection Success
   └─▶ Flush queued messages
   └─▶ Resubscribe to all event listeners

6. Reconnection Failed
   └─▶ Increase backoff delay
   └─▶ Retry (max 10 attempts)
```

### Reconnection Strategy

**Exponential Backoff:**
```
Attempt 1: Wait 1s
Attempt 2: Wait 2s
Attempt 3: Wait 4s
Attempt 4: Wait 8s
Attempt 5: Wait 16s
Max: Wait 30s (cap)
```

**Implementation:**
```typescript
private reconnectionAttempts = 0;
private maxReconnectionDelay = 30000;

private getReconnectionDelay(): number {
  return Math.min(
    1000 * Math.pow(2, this.reconnectionAttempts),
    this.maxReconnectionDelay
  );
}

private reconnect() {
  const delay = this.getReconnectionDelay();
  setTimeout(() => {
    this.reconnectionAttempts++;
    this.connect();
  }, delay);
}
```

### Message Queuing

Messages sent while disconnected are queued and sent when reconnected:

```typescript
private messageQueue: any[] = [];

send(message: any) {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(message));
  } else {
    // Queue for later
    this.messageQueue.push(message);
  }
}

private onOpen() {
  // Flush queue
  while (this.messageQueue.length > 0) {
    const message = this.messageQueue.shift();
    this.ws!.send(JSON.stringify(message));
  }
}
```

---

## Type System

### TypeScript Generics for Type Safety

```typescript
// Define typed request
interface CreateUserRequest {
  name: string;
  email: string;
}

interface CreateUserResponse {
  success: boolean;
  user: User;
}

// Type-safe invoke
const result = await ipcRenderer.invoke<CreateUserResponse>(
  'user:create',
  { name: 'John', email: 'john@example.com' }
);

result.user.name; // TypeScript knows this exists
```

### Handler Type Inference

```typescript
// Handler with typed parameters
ipcMain.handle(
  'user:create',
  async (event, data: CreateUserRequest): Promise<CreateUserResponse> => {
    // TypeScript validates return type
    return {
      success: true,
      user: await createUser(data)
    };
  }
);
```

### Event Types

```typescript
// Typed event listeners
interface UserCreatedEvent {
  id: string;
  name: string;
  timestamp: number;
}

ipcRenderer.on('user:created', (event, data: UserCreatedEvent) => {
  console.log(data.name); // TypeScript knows the shape
});
```

---

## Error Handling

### JSON-RPC Error Codes

We use standard JSON-RPC 2.0 error codes:

| Code | Message | Meaning |
|------|---------|---------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Missing jsonrpc/method |
| -32601 | Method not found | No handler registered |
| -32602 | Invalid params | Wrong parameter types |
| -32603 | Internal error | Handler threw exception |

### Error Propagation

```typescript
// Server
ipcMain.handle('user:create', async (event, data) => {
  if (!data.email) {
    throw new Error('Email required'); // Becomes JSON-RPC error
  }

  // Database error also propagates
  const user = await db.createUser(data); // May throw
  return { success: true, user };
});

// Client
try {
  await ipcRenderer.invoke('user:create', { name: 'John' });
} catch (error) {
  // error.message === "Email required"
  console.error('Failed to create user:', error.message);
}
```

### Custom Error Types

```typescript
class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}

// Server
ipcMain.handle('user:create', async (event, data) => {
  if (!data.email) {
    throw new ValidationError('Email required');
  }
});

// Client can check error type
try {
  await ipcRenderer.invoke('user:create', data);
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Show validation error to user
  }
}
```

---

## Connection Management

### Client Tracking

Server tracks all connected clients:

```typescript
private clients = new Map<string, WebSocket>();

addClient(clientId: string, ws: WebSocket) {
  this.clients.set(clientId, ws);
  console.log(`Client connected: ${clientId} (total: ${this.clients.size})`);
}

removeClient(clientId: string) {
  this.clients.delete(clientId);
  console.log(`Client disconnected: ${clientId} (total: ${this.clients.size})`);
}
```

### Heartbeat (Keep-Alive)

Prevent connection timeouts with periodic pings:

```typescript
// Server
wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

// Heartbeat interval (30 seconds)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate(); // Dead connection
    }

    ws.isAlive = false;
    ws.ping(); // Send ping
  });
}, 30000);
```

### Client Disconnection Cleanup

```typescript
ws.on('close', () => {
  ipcMain.removeClient(clientId);

  // Cancel any pending operations for this client
  cancelClientRequests(clientId);
});
```

---

## Performance Considerations

### Latency Comparison

| Operation | Electron IPC | electron-to-web | Overhead |
|-----------|--------------|-----------------|----------|
| invoke() | ~0.1ms | ~1-2ms | +1.9ms |
| send() | ~0.05ms | ~0.5ms | +0.45ms |
| on() listener | ~0.01ms | ~0.1ms | +0.09ms |

**Note:** WebSocket introduces minimal overhead (<2ms) which is negligible for most applications.

### Message Size Limits

WebSocket has no hard message size limit, but we recommend:

- **Small messages** (<1KB): Optimal, sent in single frame
- **Medium messages** (1KB-1MB): Fine, may span multiple frames
- **Large messages** (>1MB): Use chunking or separate HTTP endpoint

### Batch Operations

For multiple sequential operations, use Promise.all:

```typescript
// Bad: Sequential (slow)
const user1 = await ipcRenderer.invoke('user:get', 1);
const user2 = await ipcRenderer.invoke('user:get', 2);
const user3 = await ipcRenderer.invoke('user:get', 3);

// Good: Parallel (fast)
const [user1, user2, user3] = await Promise.all([
  ipcRenderer.invoke('user:get', 1),
  ipcRenderer.invoke('user:get', 2),
  ipcRenderer.invoke('user:get', 3)
]);
```

### Memory Usage

- **Per connection:** ~2KB (WebSocket overhead)
- **Per handler:** ~100 bytes (function reference)
- **Per listener:** ~50 bytes (callback reference)

For 100 concurrent connections: ~200KB total overhead.

---

## Security Model

### Authentication

The library doesn't provide built-in authentication. You should add auth middleware:

```typescript
// Example: JWT authentication
import jwt from 'jsonwebtoken';

createWebServer({
  port: 3001,
  onConnection: (ws, req) => {
    // Verify JWT token from query param or header
    const token = new URL(req.url, 'ws://localhost').searchParams.get('token');

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      ws.user = user; // Attach user to WebSocket
    } catch {
      ws.close(1008, 'Invalid token'); // Reject connection
    }
  }
});

// Access user in handlers
ipcMain.handle('user:profile', async (event) => {
  const ws = ipcMain.getClient(event.sender.id);
  return ws.user; // User from JWT
});
```

### CORS

For cross-origin requests, configure CORS:

```typescript
createWebServer({
  cors: {
    origin: 'https://your-app.com',
    credentials: true
  }
});
```

### Rate Limiting

Prevent abuse with rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
});

app.use('/ipc', limiter);
```

### Input Validation

Always validate handler inputs:

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

ipcMain.handle('user:create', async (event, data) => {
  // Validate input
  const validated = CreateUserSchema.parse(data); // Throws if invalid

  return await createUser(validated);
});
```

---

## Comparison with Alternatives

### vs. Manual HTTP + WebSocket

| Aspect | electron-to-web | Manual HTTP+WS |
|--------|-----------------|----------------|
| Setup effort | 2 import changes | Rewrite all IPC |
| Code changes | ~0% | ~80% |
| Type safety | Built-in | Manual |
| Reconnection | Automatic | Manual |
| Message queuing | Built-in | Manual |
| Maintenance | Library updates | Your code |

### vs. VSCode's vscode-jsonrpc

| Aspect | electron-to-web | vscode-jsonrpc |
|--------|-----------------|----------------|
| Purpose | Electron IPC shim | Language servers |
| Transport | WebSocket only | Stdio, IPC, WS |
| Size | ~3KB | ~50KB |
| Complexity | Low | High (LSP features) |
| Electron API | Exact match | N/A |

### vs. Electron Forge

Electron Forge is for desktop packaging, not web deployment. They solve different problems.

---

## Future Enhancements

### 1. Renderer-to-Renderer IPC

Use SharedWorker for direct renderer communication:

```typescript
// Renderer A
ipcRenderer.sendToRenderer('renderer-B-id', 'message', data);

// Renderer B
ipcRenderer.on('message', (event, data) => {
  console.log('From renderer A:', data);
});
```

### 2. Streaming Support

For large data transfers:

```typescript
// Server
ipcMain.handleStream('file:download', async function* (event, fileId) {
  const stream = fs.createReadStream(`/files/${fileId}`);
  for await (const chunk of stream) {
    yield chunk; // Send chunk as notification
  }
});

// Client
for await (const chunk of ipcRenderer.invokeStream('file:download', 'file123')) {
  console.log('Received chunk:', chunk.length);
}
```

### 3. Binary Support

Efficient binary transfer using ArrayBuffers:

```typescript
// Server
ipcMain.handle('image:process', async (event, imageBuffer: ArrayBuffer) => {
  const processed = await processImage(Buffer.from(imageBuffer));
  return processed.buffer; // Return ArrayBuffer
});
```

### 4. Middleware System

For cross-cutting concerns:

```typescript
ipcMain.use(async (event, next) => {
  console.log('Request:', event.method, event.params);
  const result = await next();
  console.log('Response:', result);
  return result;
});
```

---

## Debugging

### Enable Debug Logging

```typescript
// Server
createWebServer({
  debug: true // Logs all messages
});

// Client
ipcRenderer.enableDebug(); // Logs all requests/notifications
```

### Chrome DevTools

WebSocket messages visible in Network tab:
1. Open DevTools → Network
2. Filter: WS
3. Click connection → Messages
4. See all JSON-RPC traffic

### Common Issues

**1. Handler not found**
- Check channel name spelling (case-sensitive)
- Ensure handler registered before client connects
- Check server logs for "Registered method: ..."

**2. Listener not firing**
- Ensure listener registered before event sent
- Check WebSocket connection status
- Verify channel name matches

**3. WebSocket not connecting**
- Check server is running
- Verify wsPath matches client/server
- Check browser console for errors
- Ensure no proxy blocking WebSocket

---

## Appendix

### JSON-RPC 2.0 Specification

See: https://www.jsonrpc.org/specification

### Dependencies

- **json-rpc-2.0** - JSON-RPC client/server implementation
- **ws** - WebSocket library for Node.js

### License

MIT

---

**Last Updated:** 2026-01-03
**Version:** 1.0.0
