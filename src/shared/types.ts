/**
 * Shared types used across main and renderer processes
 */

/**
 * IPC Event object (compatible with Electron's IpcMainEvent)
 */
export interface IPCEvent {
  sender: {
    id: string;
    send?: (channel: string, ...args: any[]) => void;
  };
  returnValue?: any;
  preventDefault?: () => void;
}

/**
 * IPC Handler function signature
 */
export type IPCHandler = (event: IPCEvent, ...args: any[]) => Promise<any> | any;

/**
 * IPC Listener function signature (for notifications)
 */
export type IPCListener = (event: IPCEvent, ...args: any[]) => void;

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any[];
  id?: number | string;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

/**
 * JSON-RPC 2.0 Notification (no id)
 */
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any[];
}
