/**
 * Test runner - executes E2E tests and generates report
 */

import { spawn } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateReport } from './generate-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESULTS_FILE = join(__dirname, '.test-results.json');

console.log('🧪 Starting electron-to-web E2E tests...\n');

// Run mocha tests with JSON output to file
const mocha = spawn('npx', [
  'mocha',
  'tests/e2e.test.mjs',
  '--reporter',
  'json',
  '--reporter-option',
  `output=${RESULTS_FILE}`
], {
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: true,
});

mocha.on('close', (code) => {
  try {
    // Read JSON results from file
    const jsonOutput = readFileSync(RESULTS_FILE, 'utf8');
    const mochaResults = JSON.parse(jsonOutput);

    // Clean up results file
    try {
      unlinkSync(RESULTS_FILE);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Convert mocha results to our format
    const testResults = [];

    mochaResults.tests.forEach(test => {
      const result = {
        feature: extractFeature(test.fullTitle),
        description: extractDescription(test.fullTitle),
        status: test.err && Object.keys(test.err).length > 0 ? 'failed' : 'passed',
      };

      if (test.err && test.err.message) {
        result.error = test.err.message;
      }

      testResults.push(result);
    });

    // Generate report
    const stats = generateReport(testResults);

    // Exit with appropriate code
    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
});

mocha.on('error', (error) => {
  console.error('Failed to run tests:', error);
  process.exit(1);
});

/**
 * Extract feature name from full test title
 * Example: "Electron IPC Compatibility Tests ipcRenderer.invoke() should handle simple invoke"
 * Returns: "ipcRenderer.invoke()"
 */
function extractFeature(fullTitle) {
  const parts = fullTitle.split(' ');

  // Look for patterns like "ipcRenderer.invoke()" or "webContents.send()"
  const apiPattern = /^[\w.]+\(\)$/;
  for (const part of parts) {
    if (apiPattern.test(part)) {
      return part;
    }
  }

  // Look for multi-word features
  if (fullTitle.includes('WebSocket Connection')) return 'WebSocket Connection';
  if (fullTitle.includes('Multi-client Support')) return 'Multi-client Support';
  if (fullTitle.includes('Connection Lifecycle') || fullTitle.includes('Connection Management')) {
    return 'Connection Lifecycle';
  }
  if (fullTitle.includes('Error Handling')) return 'Error Handling';
  if (fullTitle.includes('Data Type')) return 'Data Types';

  return 'Unknown';
}

/**
 * Extract test description from full title
 */
function extractDescription(fullTitle) {
  const parts = fullTitle.split(' should ');
  if (parts.length > 1) {
    return 'should ' + parts[parts.length - 1];
  }

  // Fallback: take last part after last describe block
  const lastPart = fullTitle.split(' ').slice(-10).join(' ');
  return lastPart;
}
