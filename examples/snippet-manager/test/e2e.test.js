/**
 * E2E Tests for Snippet Manager Web Version
 *
 * These tests verify that the web version works correctly with electron-to-web
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import WebSocket from 'ws';

// Test configuration
const SERVER_PORT = 3001;
const WS_URL = `ws://localhost:${SERVER_PORT}/ipc`;
const HTTP_URL = `http://localhost:${SERVER_PORT}`;

let serverProcess;
let ws;

/**
 * Start the web server
 */
async function startServer() {
  console.log('🚀 Starting web server...');

  serverProcess = spawn('node', ['server.js'], {
    cwd: 'web-server',
    stdio: 'pipe'
  });

  // Wait for server to start
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server failed to start in 10 seconds'));
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running on')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
  });

  console.log('✅ Server started');
}

/**
 * Stop the web server
 */
async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    await setTimeout(1000);
    console.log('✅ Server stopped');
  }
}

/**
 * Connect to WebSocket
 */
async function connectWebSocket() {
  console.log('🔌 Connecting to WebSocket...');

  ws = new WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('✅ WebSocket connected');
}

/**
 * Send JSON-RPC request
 */
async function invokeIPC(method, params = []) {
  const id = Date.now();
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };

  ws.send(JSON.stringify(request));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Request timed out: ${method}`));
    }, 5000);

    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === id) {
        ws.off('message', handler);
        clearTimeout(timeout);

        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Test: Get App Info
 */
async function testAppInfo() {
  console.log('\n📋 Testing app:getInfo...');

  const info = await invokeIPC('app:getInfo');

  assert(info.name, 'App name should exist');
  assert(info.version, 'App version should exist');
  assert(info.snippetsPath, 'Snippets path should exist');

  console.log(`   Name: ${info.name}`);
  console.log(`   Version: ${info.version}`);
  console.log(`   Snippets: ${info.snippetsPath}`);

  console.log('✅ app:getInfo passed');
}

/**
 * Test: Get All Snippets
 */
async function testGetAllSnippets() {
  console.log('\n📋 Testing snippets:getAll...');

  const result = await invokeIPC('snippets:getAll');

  assert(result.success === true, 'Should return success');
  assert(Array.isArray(result.snippets), 'Should return array of snippets');

  console.log(`   Found ${result.snippets.length} snippets`);
  console.log('✅ snippets:getAll passed');

  return result.snippets.length;
}

/**
 * Test: Create Snippet
 */
async function testCreateSnippet() {
  console.log('\n📋 Testing snippets:save (create)...');

  const snippet = {
    title: 'Test Snippet',
    language: 'javascript',
    code: 'console.log("Hello from e2e test!");',
    description: 'A test snippet created by E2E tests',
    tags: ['test', 'e2e']
  };

  const result = await invokeIPC('snippets:save', [snippet]);

  assert(result.success === true, 'Should return success');
  assert(result.snippet, 'Should return snippet');
  assert(result.snippet.id, 'Snippet should have ID');
  assert(result.snippet.title === snippet.title, 'Title should match');

  console.log(`   Created snippet with ID: ${result.snippet.id}`);
  console.log('✅ snippets:save passed');

  return result.snippet.id;
}

/**
 * Test: Get Single Snippet
 */
async function testGetSnippet(snippetId) {
  console.log('\n📋 Testing snippets:get...');

  const result = await invokeIPC('snippets:get', [snippetId]);

  assert(result.success === true, 'Should return success');
  assert(result.snippet, 'Should return snippet');
  assert(result.snippet.id === snippetId, 'Should return correct snippet');

  console.log(`   Retrieved snippet: ${result.snippet.title}`);
  console.log('✅ snippets:get passed');
}

/**
 * Test: Update Snippet
 */
async function testUpdateSnippet(snippetId) {
  console.log('\n📋 Testing snippets:save (update)...');

  const snippet = {
    id: snippetId,
    title: 'Updated Test Snippet',
    language: 'typescript',
    code: 'console.log("Updated!");',
    description: 'Updated description',
    tags: ['test', 'updated']
  };

  const result = await invokeIPC('snippets:save', [snippet]);

  assert(result.success === true, 'Should return success');
  assert(result.snippet.title === snippet.title, 'Title should be updated');

  console.log('✅ snippets:save (update) passed');
}

/**
 * Test: Delete Snippet
 */
async function testDeleteSnippet(snippetId) {
  console.log('\n📋 Testing snippets:delete...');

  const result = await invokeIPC('snippets:delete', [snippetId]);

  assert(result.success === true, 'Should return success');

  console.log('✅ snippets:delete passed');
}

/**
 * Simple assertion helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Snippet Manager - E2E Tests');
  console.log('='.repeat(60));

  try {
    // Setup
    await startServer();
    await setTimeout(2000); // Wait for server to be fully ready
    await connectWebSocket();

    // Run tests
    await testAppInfo();
    const initialCount = await testGetAllSnippets();
    const snippetId = await testCreateSnippet();
    await testGetSnippet(snippetId);
    await testUpdateSnippet(snippetId);
    const updatedCount = await testGetAllSnippets();
    assert(updatedCount === initialCount + 1, 'Snippet count should increase by 1');
    await testDeleteSnippet(snippetId);
    const finalCount = await testGetAllSnippets();
    assert(finalCount === initialCount, 'Snippet count should return to initial');

    // Success!
    console.log('');
    console.log('='.repeat(60));
    console.log('  ✅ All tests passed!');
    console.log('='.repeat(60));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (ws) {
      ws.close();
    }
    await stopServer();
  }
}

// Run tests
runTests();
