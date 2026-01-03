/**
 * Server factory
 * Creates Express HTTP server + WebSocket server for JSON-RPC IPC
 */

import type { Application, RequestHandler } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import { ipcMain } from '../main/ipc-main.js';
import { registerNativeHandlers, unregisterNativeHandlers } from '../main/native-handlers.js';
import { mergeSecurityConfig, type SecurityConfig } from '../shared/security-config.js';

export interface ServerOptions {
  /** HTTP port (default: 3001) */
  port?: number;

  /** Directory to serve static files from */
  staticDir?: string;

  /** WebSocket path (default: '/ipc') */
  wsPath?: string;

  /** Enable CORS */
  cors?: boolean | {
    origin?: string | string[];
    credentials?: boolean;
  };

  /** Authentication middleware */
  authentication?: RequestHandler;

  /** Security configuration for native API operations */
  security?: SecurityConfig;

  /** Callback when client connects */
  onConnection?: (ws: WebSocket, clientId: string) => void;

  /** Callback when client disconnects */
  onDisconnect?: (clientId: string) => void;
}

let clientIdCounter = 0;

/**
 * Generate unique client ID
 */
function generateClientId(): string {
  return `client-${Date.now()}-${++clientIdCounter}`;
}

/**
 * Create web server with JSON-RPC over WebSocket
 *
 * @param options Server configuration options
 * @returns Server instances (app, server, wss)
 */
export async function createWebServer(options: ServerOptions = {}): Promise<{
  app: Application;
  server: HTTPServer;
  wss: WebSocketServer;
}> {
  // Dynamic import of express to avoid bundling in renderer
  let express: any;
  let app: Application;
  let server: HTTPServer;

  try {
    express = (await import('express')).default;
  } catch (error) {
    throw new Error('express is required. Install it with: npm install express');
  }

  const {
    port = 3001,
    staticDir,
    wsPath = '/ipc',
    cors = false,
    authentication,
    security,
    onConnection,
    onDisconnect,
  } = options;

  app = express();

  // Register native API handlers with security config
  if (security) {
    const securityConfig = mergeSecurityConfig(security);
    registerNativeHandlers(securityConfig);
  }

  // JSON body parser
  app.use(express.json());

  // CORS
  if (cors) {
    const corsOrigin = typeof cors === 'object' ? cors.origin : '*';
    const corsCredentials = typeof cors === 'object' ? cors.credentials : false;

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', corsOrigin as string);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (corsCredentials) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  // Authentication middleware (if provided)
  if (authentication) {
    app.use(authentication);
  }

  // Serve static files
  if (staticDir) {
    app.use(express.static(staticDir));
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: ipcMain['clients'].size,
    });
  });

  // Start HTTP server
  server = app.listen(port, () => {
    console.log(`[electron-to-web] HTTP server listening on port ${port}`);
  });

  // Create WebSocket server
  const wss = new WebSocketServer({
    server,
    path: wsPath,
  });

  console.log(`[electron-to-web] WebSocket server listening on ${wsPath}`);

  // Handle WebSocket connections
  wss.on('connection', (ws, _req) => {
    const clientId = generateClientId();

    console.log(`[electron-to-web] Client connected: ${clientId}`);

    // Register client
    ipcMain.addClient(clientId, ws);

    // Call user callback
    if (onConnection) {
      onConnection(ws, clientId);
    }

    // Handle messages
    ws.on('message', async (data) => {
      try {
        await ipcMain.handleMessage(ws, data.toString(), clientId);
      } catch (error) {
        console.error(`[electron-to-web] Error handling message from ${clientId}:`, error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`[electron-to-web] Client disconnected: ${clientId}`);
      ipcMain.removeClient(clientId);

      // Call user callback
      if (onDisconnect) {
        onDisconnect(clientId);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[electron-to-web] WebSocket error for ${clientId}:`, error);
    });
  });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // 30 seconds

  wss.on('connection', (ws: any) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Cleanup on server close
  server.on('close', () => {
    clearInterval(heartbeatInterval);
    wss.close();

    // Unregister native handlers if they were registered
    if (security) {
      unregisterNativeHandlers();
    }
  });

  return { app, server, wss };
}
