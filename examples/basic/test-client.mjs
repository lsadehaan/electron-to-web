/**
 * Simple WebSocket client to test electron-to-web IPC
 */

import { WebSocket } from 'ws';

console.log('[Client] Connecting to ws://localhost:3001/ipc...');

const ws = new WebSocket('ws://localhost:3001/ipc');

ws.on('open', async () => {
  console.log('[Client] Connected!');

  // Test 1: invoke ping
  console.log('\n[Client] Test 1: Sending ping request...');
  const pingRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'ping',
    params: ['Hello from client!'],
  };
  ws.send(JSON.stringify(pingRequest));

  // Test 2: invoke echo after delay
  setTimeout(() => {
    console.log('\n[Client] Test 2: Sending echo request...');
    const echoRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'echo',
      params: ['arg1', 'arg2', 'arg3'],
    };
    ws.send(JSON.stringify(echoRequest));
  }, 1000);

  // Disconnect after tests
  setTimeout(() => {
    console.log('\n[Client] Tests complete, disconnecting...');
    ws.close();
    process.exit(0);
  }, 2000);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('[Client] Received:', JSON.stringify(message, null, 2));
});

ws.on('close', () => {
  console.log('[Client] Disconnected');
});

ws.on('error', (error) => {
  console.error('[Client] Error:', error);
});
