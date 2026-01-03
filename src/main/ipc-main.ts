/**
 * IPCMain - Server-side IPC handler
 * Provides Electron-compatible IPC API using JSON-RPC over WebSocket
 */

import { JSONRPCServer, JSONRPCServerMiddleware } from 'json-rpc-2.0';
import type { WebSocket } from 'ws';
import type { IPCEvent, IPCHandler } from '../shared/types.js';

export class IPCMain {
  private server: JSONRPCServer;
  private clients = new Map<string, WebSocket>();
  private handlers = new Map<string, IPCHandler>();
  private listeners = new Map<string, Set<IPCHandler>>(); // For on() event listeners

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
   * Handle invoke once (Electron-compatible API)
   * Automatically removes handler after first invocation
   * @param channel - IPC channel name
   * @param handler - Handler function
   */
  handleOnce(channel: string, handler: IPCHandler): void {
    const onceWrapper: IPCHandler = async (event, ...args) => {
      this.removeHandler(channel);
      return await handler(event, ...args);
    };

    this.handle(channel, onceWrapper);
  }

  /**
   * Listen for one-way messages (Electron-compatible API)
   * For use with ipcRenderer.send()
   * @param channel - IPC channel name
   * @param listener - Listener function
   */
  on(channel: string, listener: IPCHandler): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }

    this.listeners.get(channel)!.add(listener);

    // Register JSON-RPC notification handler if not already registered
    if (!this.handlers.has(channel)) {
      this.server.addMethod(channel, async (params: any) => {
        const mockEvent: IPCEvent = {
          sender: {
            id: 'renderer',
          },
        };

        const args = Array.isArray(params) ? params : [params];
        const channelListeners = this.listeners.get(channel);

        if (channelListeners) {
          // Call all listeners (no response expected for on())
          for (const listener of channelListeners) {
            try {
              await listener(mockEvent, ...args);
            } catch (error) {
              console.error(`[IPC] Error in listener for ${channel}:`, error);
            }
          }
        }

        // Return undefined for one-way messages
        return undefined;
      });

      console.log(`[IPC] Registered listener channel: ${channel}`);
    }
  }

  /**
   * Listen for one-way message once (Electron-compatible API)
   * Automatically removes listener after first invocation
   * @param channel - IPC channel name
   * @param listener - Listener function
   */
  once(channel: string, listener: IPCHandler): void {
    const onceWrapper: IPCHandler = async (event, ...args) => {
      this.removeListener(channel, onceWrapper);
      return await listener(event, ...args);
    };

    this.on(channel, onceWrapper);
  }

  /**
   * Remove specific listener (Electron-compatible API)
   * @param channel - IPC channel name
   * @param listener - Listener function to remove
   */
  removeListener(channel: string, listener: IPCHandler): void {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.delete(listener);

      // Clean up if no listeners left
      if (listeners.size === 0) {
        this.listeners.delete(channel);
        // Also remove the JSON-RPC method if no invoke handler exists
        if (!this.handlers.has(channel)) {
          this.server.removeMethod(channel);
          console.log(`[IPC] Removed listener channel: ${channel}`);
        }
      }
    }
  }

  /**
   * Alias for removeListener (Electron-compatible API)
   */
  off(channel: string, listener: IPCHandler): void {
    this.removeListener(channel, listener);
  }

  /**
   * Remove all listeners for channel (Electron-compatible API)
   * If no channel specified, removes all listeners for all channels
   * @param channel - Optional channel name
   */
  removeAllListeners(channel?: string): void {
    if (channel) {
      this.listeners.delete(channel);
      // Remove JSON-RPC method if no invoke handler exists
      if (!this.handlers.has(channel)) {
        this.server.removeMethod(channel);
        console.log(`[IPC] Removed all listeners for channel: ${channel}`);
      }
    } else {
      this.listeners.clear();
      // Remove all JSON-RPC methods that are only listeners (not handlers)
      for (const [ch] of this.listeners) {
        if (!this.handlers.has(ch)) {
          this.server.removeMethod(ch);
        }
      }
      console.log(`[IPC] Removed all listeners for all channels`);
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param ws - WebSocket connection
   * @param message - Raw message string
   * @param clientId - Client identifier
   */
  async handleMessage(ws: WebSocket, message: string, _clientId?: string): Promise<void> {
    try {
      const jsonRPCMessage = JSON.parse(message);

      const response = await this.server.receive(jsonRPCMessage);

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

    for (const [_clientId, ws] of this.clients) {
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
