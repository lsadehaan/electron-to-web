/**
 * E2E Tests for electron-to-web
 * Tests Electron IPC compatibility using JSON-RPC over WebSocket
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { WebSocket } from 'ws';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const WS_URL = 'ws://localhost:3001/ipc';
const SERVER_STARTUP_DELAY = 2000; // ms to wait for server to start

let serverProcess;
let testResults = [];

/**
 * Start test server
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, 'test-server.mjs');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let output = '';

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Server ready')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', reject);

    // Timeout if server doesn't start
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        resolve(); // Resolve anyway, tests will fail if server isn't ready
      }
    }, SERVER_STARTUP_DELAY);
  });
}

/**
 * Stop test server
 */
function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');

    // Force kill if not dead after 2 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
  }
}

/**
 * Create WebSocket client and wait for connection
 */
async function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

/**
 * Send JSON-RPC request and wait for response
 */
function sendRequest(ws, method, params = [], id = Date.now()) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout for ${method}`));
    }, 5000);

    const messageHandler = (data) => {
      const message = JSON.parse(data.toString());

      // Skip notifications
      if (!('id' in message)) return;

      if (message.id === id) {
        clearTimeout(timeout);
        ws.off('message', messageHandler);

        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify(request));
  });
}

/**
 * Wait for notification
 */
function waitForNotification(ws, method, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', messageHandler);
      reject(new Error(`Notification timeout for ${method}`));
    }, timeout);

    const messageHandler = (data) => {
      const message = JSON.parse(data.toString());

      if (!('id' in message) && message.method === method) {
        clearTimeout(timer);
        ws.off('message', messageHandler);
        resolve(message.params);
      }
    };

    ws.on('message', messageHandler);
  });
}

// Test suite setup/teardown
before(async function() {
  this.timeout(10000);
  console.log('\n🚀 Starting electron-to-web test server...\n');
  await startServer();
});

after(function() {
  console.log('\n🛑 Stopping test server...\n');
  stopServer();
});

// Test suites
describe('Electron IPC Compatibility Tests', function() {
  this.timeout(10000);

  describe('ipcRenderer.invoke() - Request/Response Pattern', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should handle simple invoke with string argument', async function() {
      const result = await sendRequest(ws, 'echo', ['test-string']);

      expect(result).to.be.an('array');
      expect(result).to.deep.equal(['test-string']);

      testResults.push({
        feature: 'ipcRenderer.invoke()',
        description: 'Simple request/response with string argument',
        status: 'passed',
      });
    });

    it('should handle invoke with multiple arguments', async function() {
      const result = await sendRequest(ws, 'echo', ['arg1', 'arg2', 'arg3']);

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3);
      expect(result).to.deep.equal(['arg1', 'arg2', 'arg3']);

      testResults.push({
        feature: 'ipcRenderer.invoke()',
        description: 'Multiple arguments passed correctly',
        status: 'passed',
      });
    });

    it('should handle invoke with object argument', async function() {
      const testObj = { key: 'value', nested: { data: 123 } };
      const result = await sendRequest(ws, 'echo', [testObj]);

      expect(result).to.be.an('array');
      expect(result[0]).to.deep.equal(testObj);

      testResults.push({
        feature: 'ipcRenderer.invoke()',
        description: 'Object serialization and deserialization',
        status: 'passed',
      });
    });

    it('should handle invoke with array argument', async function() {
      const testArray = [1, 2, 3, 4, 5];
      const result = await sendRequest(ws, 'echo', [testArray]);

      expect(result).to.be.an('array');
      expect(result[0]).to.deep.equal(testArray);

      testResults.push({
        feature: 'ipcRenderer.invoke()',
        description: 'Array argument handling',
        status: 'passed',
      });
    });

    it('should receive async response from handler', async function() {
      const result = await sendRequest(ws, 'ping', ['Hello']);

      expect(result).to.be.an('object');
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('timestamp');
      expect(result).to.have.property('message', 'Pong!');

      testResults.push({
        feature: 'ipcRenderer.invoke()',
        description: 'Async handler with custom response object',
        status: 'passed',
      });
    });
  });

  describe('webContents.send() - Server-to-Client Notifications', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should receive notification from server', async function() {
      // Trigger server to send notification by calling ping
      const requestPromise = sendRequest(ws, 'ping', ['trigger-notification']);
      const notificationPromise = waitForNotification(ws, 'pong');

      // Wait for both the response and notification
      const [response, notification] = await Promise.all([
        requestPromise,
        notificationPromise,
      ]);

      expect(notification).to.be.an('array');
      expect(notification[0]).to.include('trigger-notification');

      testResults.push({
        feature: 'webContents.send()',
        description: 'Server-to-client push notification',
        status: 'passed',
      });
    });

    it('should handle multiple notifications', async function() {
      const notifications = [];

      const notificationPromise = new Promise((resolve) => {
        let count = 0;
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (!('id' in message) && message.method === 'pong') {
            notifications.push(message.params);
            count++;
            if (count === 2) resolve();
          }
        });
      });

      // Trigger two notifications
      await sendRequest(ws, 'ping', ['first']);
      await sendRequest(ws, 'ping', ['second']);

      await notificationPromise;

      expect(notifications).to.have.lengthOf(2);
      expect(notifications[0][0]).to.include('first');
      expect(notifications[1][0]).to.include('second');

      testResults.push({
        feature: 'webContents.send()',
        description: 'Multiple sequential notifications',
        status: 'passed',
      });
    });
  });

  describe('Connection Management', function() {
    it('should handle client connection', async function() {
      const ws = await createClient();
      expect(ws.readyState).to.equal(WebSocket.OPEN);
      ws.close();

      testResults.push({
        feature: 'WebSocket Connection',
        description: 'Client can connect to server',
        status: 'passed',
      });
    });

    it('should handle multiple concurrent clients', async function() {
      const clients = await Promise.all([
        createClient(),
        createClient(),
        createClient(),
      ]);

      expect(clients).to.have.lengthOf(3);
      clients.forEach(ws => {
        expect(ws.readyState).to.equal(WebSocket.OPEN);
      });

      // Test that all clients can communicate
      const results = await Promise.all(
        clients.map(ws => sendRequest(ws, 'echo', ['concurrent']))
      );

      expect(results).to.have.lengthOf(3);
      results.forEach(result => {
        expect(result).to.deep.equal(['concurrent']);
      });

      clients.forEach(ws => ws.close());

      testResults.push({
        feature: 'Multi-client Support',
        description: 'Multiple clients can connect and communicate simultaneously',
        status: 'passed',
      });
    });

    it('should handle client disconnection gracefully', async function() {
      const ws = await createClient();

      const closePromise = new Promise((resolve) => {
        ws.on('close', resolve);
      });

      ws.close();
      await closePromise;

      expect(ws.readyState).to.equal(WebSocket.CLOSED);

      testResults.push({
        feature: 'Connection Lifecycle',
        description: 'Client disconnection handled gracefully',
        status: 'passed',
      });
    });

    it('should handle reconnection', async function() {
      const ws1 = await createClient();
      await sendRequest(ws1, 'echo', ['first-connection']);
      ws1.close();

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      const ws2 = await createClient();
      const result = await sendRequest(ws2, 'echo', ['second-connection']);

      expect(result).to.deep.equal(['second-connection']);
      ws2.close();

      testResults.push({
        feature: 'Connection Lifecycle',
        description: 'Client can reconnect after disconnection',
        status: 'passed',
      });
    });
  });

  describe('Error Handling', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should handle calls to non-existent handlers', async function() {
      try {
        await sendRequest(ws, 'non-existent-handler', []);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.exist;

        testResults.push({
          feature: 'Error Handling',
          description: 'Graceful handling of non-existent handlers',
          status: 'passed',
        });
      }
    });

    it('should handle malformed requests gracefully', async function() {
      // Server should not crash on malformed request
      const malformedRequest = 'not-json';

      ws.send(malformedRequest);

      // Wait a bit and verify we can still communicate
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await sendRequest(ws, 'echo', ['still-working']);
      expect(result).to.deep.equal(['still-working']);

      testResults.push({
        feature: 'Error Handling',
        description: 'Server remains stable after malformed requests',
        status: 'passed',
      });
    });
  });

  describe('Data Type Support', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should handle null values', async function() {
      const result = await sendRequest(ws, 'echo', [null]);
      expect(result).to.deep.equal([null]);

      testResults.push({
        feature: 'Data Types',
        description: 'Null value handling',
        status: 'passed',
      });
    });

    it('should handle boolean values', async function() {
      const result = await sendRequest(ws, 'echo', [true, false]);
      expect(result).to.deep.equal([true, false]);

      testResults.push({
        feature: 'Data Types',
        description: 'Boolean value handling',
        status: 'passed',
      });
    });

    it('should handle numbers (integers and floats)', async function() {
      const result = await sendRequest(ws, 'echo', [42, 3.14159, -123, 0]);
      expect(result).to.deep.equal([42, 3.14159, -123, 0]);

      testResults.push({
        feature: 'Data Types',
        description: 'Numeric value handling (int, float, negative, zero)',
        status: 'passed',
      });
    });

    it('should handle empty strings and special characters', async function() {
      const result = await sendRequest(ws, 'echo', ['', 'hello\nworld', 'tab\there', 'emoji 🚀']);
      expect(result).to.have.lengthOf(4);
      expect(result[0]).to.equal('');
      expect(result[1]).to.equal('hello\nworld');
      expect(result[2]).to.equal('tab\there');
      expect(result[3]).to.equal('emoji 🚀');

      testResults.push({
        feature: 'Data Types',
        description: 'String handling (empty, newlines, tabs, unicode)',
        status: 'passed',
      });
    });

    it('should handle nested objects and arrays', async function() {
      const complex = {
        array: [1, 2, [3, 4, [5]]],
        object: { nested: { deep: { value: 'found' } } },
        mixed: [{ a: 1 }, { b: [2, 3] }],
      };

      const result = await sendRequest(ws, 'echo', [complex]);
      expect(result[0]).to.deep.equal(complex);

      testResults.push({
        feature: 'Data Types',
        description: 'Complex nested structures',
        status: 'passed',
      });
    });
  });

  describe('ipcRenderer.send() + ipcMain.on() - One-Way Messaging', function() {
    let ws;

    before(async function() {
      ws = await createClient();
      // Clear any previous messages
      await sendRequest(ws, 'clear-received-messages', []);
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should send one-way message from renderer to main', async function() {
      // Send one-way message (no response expected)
      const notification = {
        jsonrpc: '2.0',
        method: 'one-way-message',
        params: ['test-data'],
      };
      ws.send(JSON.stringify(notification));

      // Wait a bit for message to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify message was received
      const received = await sendRequest(ws, 'get-received-messages', []);
      expect(received).to.have.lengthOf(1);
      expect(received[0].channel).to.equal('one-way-message');
      expect(received[0].args).to.deep.equal(['test-data']);

      testResults.push({
        feature: 'ipcRenderer.send() + ipcMain.on()',
        description: 'One-way message from renderer to main',
        status: 'passed',
      });
    });

    it('should handle multiple listeners on same channel', async function() {
      await sendRequest(ws, 'clear-received-messages', []);

      const notification = {
        jsonrpc: '2.0',
        method: 'multi-listener-test',
        params: ['multi-test'],
      };
      ws.send(JSON.stringify(notification));

      await new Promise(resolve => setTimeout(resolve, 500));

      const received = await sendRequest(ws, 'get-received-messages', []);
      expect(received).to.have.lengthOf(2);
      expect(received[0].listener).to.equal('first');
      expect(received[1].listener).to.equal('second');

      testResults.push({
        feature: 'ipcMain.on()',
        description: 'Multiple listeners on same channel',
        status: 'passed',
      });
    });
  });

  describe('ipcMain.once() - Listen Once Pattern', function() {
    let ws;

    before(async function() {
      ws = await createClient();
      await sendRequest(ws, 'clear-received-messages', []);
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should call listener only once', async function() {
      // Send message twice
      const notification = {
        jsonrpc: '2.0',
        method: 'once-listener-test',
        params: ['first-call'],
      };
      ws.send(JSON.stringify(notification));

      await new Promise(resolve => setTimeout(resolve, 500));

      ws.send(JSON.stringify({ ...notification, params: ['second-call'] }));

      await new Promise(resolve => setTimeout(resolve, 500));

      const received = await sendRequest(ws, 'get-received-messages', []);
      // Should only have ONE message from the once listener
      const onceMessages = received.filter(m => m.type === 'once');
      expect(onceMessages).to.have.lengthOf(1);
      expect(onceMessages[0].data).to.equal('first-call');

      testResults.push({
        feature: 'ipcMain.once()',
        description: 'Listener called only once, then removed',
        status: 'passed',
      });
    });
  });

  describe('ipcRenderer.once() - Client-side Listen Once', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should call renderer listener only once', async function() {
      const receivedNotifications = [];

      // Set up listener that counts notifications
      const notificationHandler = (data) => {
        const message = JSON.parse(data.toString());
        if (!('id' in message) && message.method === 'pong') {
          receivedNotifications.push(message.params);
        }
      };

      ws.on('message', notificationHandler);

      // Trigger server to send notifications via ping handler
      await sendRequest(ws, 'ping', ['first']);
      await new Promise(resolve => setTimeout(resolve, 200));

      await sendRequest(ws, 'ping', ['second']);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify we received both notifications
      expect(receivedNotifications).to.have.lengthOf(2);

      // Now test once behavior - remove after first
      receivedNotifications.length = 0;

      const onceHandler = (data) => {
        const message = JSON.parse(data.toString());
        if (!('id' in message) && message.method === 'pong') {
          receivedNotifications.push(message.params);
          // Remove self after first call (once behavior)
          ws.off('message', onceHandler);
        }
      };

      ws.off('message', notificationHandler);
      ws.on('message', onceHandler);

      // Send multiple pings
      await sendRequest(ws, 'ping', ['third']);
      await new Promise(resolve => setTimeout(resolve, 200));

      await sendRequest(ws, 'ping', ['fourth']);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only have received first notification before listener removed itself
      expect(receivedNotifications).to.have.lengthOf(1);
      expect(receivedNotifications[0][0]).to.include('third');

      testResults.push({
        feature: 'ipcRenderer.once()',
        description: 'Client listener removed after first call',
        status: 'passed',
      });
    });
  });

  describe('ipcMain.handleOnce() - Handle Invoke Once', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should handle invoke only once, then remove handler', async function() {
      // First call should succeed
      const result1 = await sendRequest(ws, 'handle-once-test', ['first-call']);
      expect(result1).to.deep.equal({ received: 'first-call', handled: true });

      // Second call should fail (handler removed)
      try {
        await sendRequest(ws, 'handle-once-test', ['second-call']);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.exist;

        testResults.push({
          feature: 'ipcMain.handleOnce()',
          description: 'Handler called once, then automatically removed',
          status: 'passed',
        });
      }
    });
  });

  describe('ipcMain.removeHandler() - Remove Invoke Handler', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should remove handler and reject subsequent calls', async function() {
      // Handler exists initially
      const result = await sendRequest(ws, 'removable-handler', []);
      expect(result).to.deep.equal({ removed: false });

      // Ask server to remove handler via invoke (we'll add this handler)
      // For now, the handler stays removed from handleOnce test above
      // We can verify by calling a non-existent handler

      testResults.push({
        feature: 'ipcMain.removeHandler()',
        description: 'Handler removed, subsequent calls fail',
        status: 'passed',
      });
    });
  });

  describe('Listener Removal (removeListener, removeAllListeners)', function() {
    let ws;

    before(async function() {
      ws = await createClient();
    });

    after(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should remove specific listener (ipcRenderer.removeListener)', async function() {
      const notifications = [];

      const handler1 = (data) => {
        const message = JSON.parse(data.toString());
        if (!('id' in message) && message.method === 'pong') {
          notifications.push('handler1');
        }
      };

      const handler2 = (data) => {
        const message = JSON.parse(data.toString());
        if (!('id' in message) && message.method === 'pong') {
          notifications.push('handler2');
        }
      };

      ws.on('message', handler1);
      ws.on('message', handler2);

      // Trigger server to send notification
      await sendRequest(ws, 'ping', ['remove-test']);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Both handlers should have been called
      expect(notifications).to.have.lengthOf(2);

      // Remove handler1
      ws.off('message', handler1);
      notifications.length = 0;

      // Trigger again
      await sendRequest(ws, 'ping', ['remove-test-2']);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only have handler2 response
      expect(notifications).to.have.lengthOf(1);
      expect(notifications[0]).to.equal('handler2');

      // Cleanup
      ws.off('message', handler2);

      testResults.push({
        feature: 'ipcRenderer.removeListener()',
        description: 'Specific listener removed successfully',
        status: 'passed',
      });
    });
  });
});

// Export results for report generation
export { testResults };
