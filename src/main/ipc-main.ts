/**
 * IPCMain - Server-side IPC handler
 * Provides Electron-compatible IPC API using JSON-RPC over WebSocket
 */

import { Server as JSONRPCServer, JSONRPCServerMiddleware } from 'json-rpc-2.0';
import type { WebSocket } from 'ws';
import type { IPCEvent, IPCHandler } from '../shared/types.js';

export class IPCMain {
  private server: JSONRPCServer;
  private clients = new Map<string, WebSocket>();
  private handlers = new Map<string, IPCHandler>();

  constructor() {
    // Create JSON-RPC server
    this.server = new JSONRPCServer();

    // Add error handling middleware
    this.server.applyMiddleware(
      this.createErrorMiddleware() as JSONRPCServerMiddleware<void>
    );
  }

  /**
   * Register IPC handler (Electron-compatible API)
   * @param channel - IPC channel name (becomes JSON-RPC method)
   * @param handler - Handler function (receives event + params)
   */
  handle(channel: string, handler: IPCHandler): void {
    // Store handler reference
    this.handlers.set(channel, handler);

    // Register with JSON-RPC server
    this.server.addMethod(channel, async (params: any) => {
      // Create mock Electron event object
      const mockEvent: IPCEvent = {
        sender: {
          id: 'renderer', // Will be replaced with actual client ID in handleMessage
        },
      };

      // Call handler with Electron-style signature: (event, ...args)
      // params is an array, so spread it
      const args = Array.isArray(params) ? params : [params];
      return await handler(mockEvent, ...args);
    });

    console.log(`[IPC] Registered handler: ${channel}`);
  }

  /**
   * Remove IPC handler (Electron-compatible API)
   * @param channel - IPC channel name
   */
  removeHandler(channel: string): void {
    this.handlers.delete(channel);
    this.server.removeMethod(channel);
    console.log(`[IPC] Removed handler: ${channel}`);
  }

  /**
   * Handle incoming WebSocket message
   * @param ws - WebSocket connection
   * @param message - Raw message string
   * @param clientId - Client identifier
   */
  async handleMessage(ws: WebSocket, message: string, clientId?: string): Promise<void> {
    try {
      const jsonRPCMessage = JSON.parse(message);

      // Create server middleware to inject client ID into event
      const withClientId: JSONRPCServerMiddleware<void> = async (next, request, serverParams) => {
        // Modify handler to inject correct client ID
        const originalMethod = this.server['nameToMethodMapping'].get(request.method);
        if (originalMethod) {
          // Wrap handler to inject client ID
          const wrappedMethod = async (params: any) => {
            const handler = this.handlers.get(request.method);
            if (handler) {
              const mockEvent: IPCEvent = {
                sender: {
                  id: clientId || 'unknown',
                },
              };
              const args = Array.isArray(params) ? params : [params];
              return await handler(mockEvent, ...args);
            }
            return originalMethod(params);
          };

          // Temporarily replace method
          this.server['nameToMethodMapping'].set(request.method, wrappedMethod);
        }

        return await next(request, serverParams);
      };

      const response = await this.server.receiveAndSend(jsonRPCMessage);

      // Send response if present (requests have responses, notifications don't)
      if (response && ws.readyState === 1) {
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('[IPC] Error handling message:', error);

      // Send error response
      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
            },
            id: null,
          })
        );
      }
    }
  }

  /**
   * Add WebSocket client
   * @param clientId - Client identifier
   * @param ws - WebSocket connection
   */
  addClient(clientId: string, ws: WebSocket): void {
    this.clients.set(clientId, ws);
    console.log(`[IPC] Client connected: ${clientId} (total: ${this.clients.size})`);
  }

  /**
   * Remove WebSocket client
   * @param clientId - Client identifier
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`[IPC] Client disconnected: ${clientId} (total: ${this.clients.size})`);
  }

  /**
   * Get WebSocket for specific client
   * @param clientId - Client identifier
   */
  getClient(clientId: string): WebSocket | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Broadcast notification to all connected clients
   * @param channel - IPC channel name
   * @param args - Arguments to send
   */
  broadcast(channel: string, ...args: any[]): void {
    const notification = {
      jsonrpc: '2.0' as const,
      method: channel,
      params: args,
    };

    const message = JSON.stringify(notification);

    for (const [clientId, ws] of this.clients) {
      if (ws.readyState === 1) {
        // OPEN
        ws.send(message);
      }
    }
  }

  /**
   * Send notification to specific client
   * @param clientId - Client identifier
   * @param channel - IPC channel name
   * @param args - Arguments to send
   */
  sendTo(clientId: string, channel: string, ...args: any[]): void {
    const ws = this.clients.get(clientId);

    if (!ws) {
      console.warn(`[IPC] Client ${clientId} not found`);
      return;
    }

    if (ws.readyState !== 1) {
      console.warn(`[IPC] Client ${clientId} not connected`);
      return;
    }

    const notification = {
      jsonrpc: '2.0' as const,
      method: channel,
      params: args,
    };

    ws.send(JSON.stringify(notification));
  }

  /**
   * Create error handling middleware
   */
  private createErrorMiddleware(): any {
    return async (next: any, request: any, serverParams: any) => {
      try {
        return await next(request, serverParams);
      } catch (error) {
        console.error(`[IPC] Error in handler ${request.method}:`, error);

        // Re-throw to let JSON-RPC server handle it
        throw error;
      }
    };
  }
}

// Singleton instance
export const ipcMain = new IPCMain();
