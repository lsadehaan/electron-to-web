/**
 * IPCRenderer - Client-side IPC handler
 * Provides Electron-compatible IPC API using JSON-RPC over WebSocket
 */

import { Client as JSONRPCClient, JSONRPCRequest } from 'json-rpc-2.0';
import type { IPCEvent } from '../shared/types.js';

export class IPCRenderer {
  private client: JSONRPCClient;
  private ws?: WebSocket;
  private listeners = new Map<string, Set<Function>>();
  private messageQueue: any[] = [];
  private connected = false;
  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 10;
  private maxReconnectionDelay = 30000; // 30 seconds
  private reconnectionTimer?: NodeJS.Timeout | number;

  constructor() {
    // Create JSON-RPC client
    this.client = new JSONRPCClient((request: JSONRPCRequest) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // Queue requests until connected
        this.messageQueue.push(request);
        return Promise.reject(new Error('WebSocket not connected'));
      }

      return new Promise((resolve, reject) => {
        // Send request
        this.ws!.send(JSON.stringify(request));

        // For notifications (no ID), resolve immediately
        if (!request.id) {
          resolve(undefined);
        }

        // For requests, response will come via onmessage and be handled by client.receive()
      });
    });

    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ipc`;

    console.log('[IPCRenderer] Connecting to:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[IPCRenderer] WebSocket connected');
      this.connected = true;
      this.reconnectionAttempts = 0;

      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.ws!.send(JSON.stringify(message));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Check if it's a notification (no ID)
        if (!('id' in message) && message.method) {
          this.handleNotification(message.method, message.params || []);
          return;
        }

        // Otherwise, let JSON-RPC client handle response
        this.client.receive(message);
      } catch (error) {
        console.error('[IPCRenderer] Error parsing message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('[IPCRenderer] WebSocket disconnected');
      this.connected = false;

      // Attempt reconnection
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[IPCRenderer] WebSocket error:', error);
    };
  }

  /**
   * Reconnect with exponential backoff
   */
  private reconnect(): void {
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('[IPCRenderer] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectionAttempts),
      this.maxReconnectionDelay
    );

    console.log(`[IPCRenderer] Reconnecting in ${delay}ms (attempt ${this.reconnectionAttempts + 1})`);

    this.reconnectionTimer = setTimeout(() => {
      this.reconnectionAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Handle incoming notification from server
   */
  private handleNotification(channel: string, params: any[]): void {
    const listeners = this.listeners.get(channel);

    if (!listeners || listeners.size === 0) {
      return;
    }

    // Create mock event object
    const mockEvent: IPCEvent = {
      sender: {
        id: 'main',
      },
    };

    // Call all listeners
    for (const listener of listeners) {
      try {
        listener(mockEvent, ...params);
      } catch (error) {
        console.error(`[IPCRenderer] Error in listener for ${channel}:`, error);
      }
    }
  }

  /**
   * Invoke IPC handler (Electron-compatible API)
   * Sends JSON-RPC request and waits for response
   *
   * @param channel - IPC channel name
   * @param args - Arguments to send
   * @returns Promise resolving to handler's return value
   */
  async invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
    try {
      return await this.client.request(channel, args);
    } catch (error) {
      console.error(`[IPCRenderer] Failed to invoke ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Send one-way message (Electron-compatible API)
   * Sends JSON-RPC notification (no response expected)
   *
   * @param channel - IPC channel name
   * @param args - Arguments to send
   */
  send(channel: string, ...args: any[]): void {
    const notification = {
      jsonrpc: '2.0' as const,
      method: channel,
      params: args,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(notification));
    } else {
      // Queue for later
      this.messageQueue.push(notification);
    }
  }

  /**
   * Listen for IPC events (Electron-compatible API)
   * Registers listener for JSON-RPC notifications
   *
   * @param channel - IPC channel name
   * @param listener - Callback function
   */
  on(channel: string, listener: (event: IPCEvent, ...args: any[]) => void): this {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }

    this.listeners.get(channel)!.add(listener);
    return this;
  }

  /**
   * Listen for IPC event once (Electron-compatible API)
   * Automatically removes listener after first invocation
   *
   * @param channel - IPC channel name
   * @param listener - Callback function
   */
  once(channel: string, listener: (event: IPCEvent, ...args: any[]) => void): this {
    const onceWrapper = (event: IPCEvent, ...args: any[]) => {
      this.removeListener(channel, onceWrapper);
      listener(event, ...args);
    };

    return this.on(channel, onceWrapper);
  }

  /**
   * Remove specific event listener (Electron-compatible API)
   *
   * @param channel - IPC channel name
   * @param listener - Callback function to remove
   */
  removeListener(channel: string, listener: Function): this {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.delete(listener);

      // Clean up if no listeners left
      if (listeners.size === 0) {
        this.listeners.delete(channel);
      }
    }
    return this;
  }

  /**
   * Remove all listeners for channel (Electron-compatible API)
   * If no channel specified, removes all listeners for all channels
   *
   * @param channel - Optional channel name
   */
  removeAllListeners(channel?: string): this {
    if (channel) {
      this.listeners.delete(channel);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  /**
   * Check if WebSocket is connected
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Enable debug logging
   */
  enableDebug(): void {
    // Log all requests
    const originalRequest = this.client.request.bind(this.client);
    this.client.request = async (method: string, params?: any) => {
      console.log('[IPCRenderer] Request:', method, params);
      const result = await originalRequest(method, params);
      console.log('[IPCRenderer] Response:', method, result);
      return result;
    };

    // Log all notifications
    const originalSend = this.send.bind(this);
    this.send = (channel: string, ...args: any[]) => {
      console.log('[IPCRenderer] Send:', channel, args);
      originalSend(channel, ...args);
    };
  }

  /**
   * Disconnect WebSocket (for cleanup)
   */
  disconnect(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer as number);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.connected = false;
  }
}

// Singleton instance
export const ipcRenderer = new IPCRenderer();
