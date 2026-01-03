/**
 * Generate test report from E2E test results
 * Produces both console output and markdown report
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Feature descriptions with details about Electron compatibility
 */
const FEATURE_DETAILS = {
  'ipcRenderer.invoke()': {
    electronAPI: 'ipcRenderer.invoke(channel, ...args)',
    description: 'Two-way communication pattern where renderer sends request and waits for response from main process',
    electronDocs: 'https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendererinvokechannel-args',
    compatibility: '100% - Full API compatibility with argument passing and async responses',
  },
  'webContents.send()': {
    electronAPI: 'webContents.send(channel, ...args)',
    description: 'One-way communication from main process to renderer, used for push notifications',
    electronDocs: 'https://www.electronjs.org/docs/latest/api/web-contents#contentssendchannel-args',
    compatibility: '100% - Implemented as JSON-RPC notifications',
  },
  'WebSocket Connection': {
    electronAPI: 'N/A (Internal)',
    description: 'Underlying transport layer replacing Electron\'s internal IPC mechanism',
    electronDocs: 'N/A',
    compatibility: 'WebSocket-based replacement for Electron IPC',
  },
  'Multi-client Support': {
    electronAPI: 'Multiple BrowserWindow instances',
    description: 'Support for multiple renderer processes (browser windows) communicating with main process',
    electronDocs: 'https://www.electronjs.org/docs/latest/api/browser-window',
    compatibility: 'Full support - Each client connection maps to a renderer process',
  },
  'Connection Lifecycle': {
    electronAPI: 'BrowserWindow lifecycle',
    description: 'Handling connection, disconnection, and reconnection of clients',
    electronDocs: 'N/A',
    compatibility: 'Automatic cleanup on disconnect, supports reconnection',
  },
  'Error Handling': {
    electronAPI: 'IPC error handling',
    description: 'Graceful handling of errors in IPC communication',
    electronDocs: 'N/A',
    compatibility: 'JSON-RPC error responses, server stability maintained',
  },
  'Data Types': {
    electronAPI: 'Structured Clone Algorithm',
    description: 'Serialization of complex data types across process boundary',
    electronDocs: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm',
    compatibility: 'JSON serialization - supports all JSON-compatible types',
  },
};

/**
 * Generate console report
 */
function generateConsoleReport(results, stats) {
  console.log('\n' + '='.repeat(80));
  console.log('  ELECTRON-TO-WEB E2E TEST REPORT');
  console.log('='.repeat(80) + '\n');

  console.log('📊 Test Summary:');
  console.log(`   Total:  ${stats.total}`);
  console.log(`   ✅ Pass: ${stats.passed} (${Math.round(stats.passRate)}%)`);
  console.log(`   ❌ Fail: ${stats.failed}`);
  console.log('');

  // Group by feature
  const byFeature = {};
  results.forEach(result => {
    if (!byFeature[result.feature]) {
      byFeature[result.feature] = [];
    }
    byFeature[result.feature].push(result);
  });

  console.log('📋 Test Results by Feature:\n');

  for (const [feature, tests] of Object.entries(byFeature)) {
    const allPassed = tests.every(t => t.status === 'passed');
    const icon = allPassed ? '✅' : '❌';

    console.log(`${icon} ${feature}`);

    if (FEATURE_DETAILS[feature]) {
      console.log(`   API: ${FEATURE_DETAILS[feature].electronAPI}`);
      console.log(`   ${FEATURE_DETAILS[feature].description}`);
      console.log(`   Compatibility: ${FEATURE_DETAILS[feature].compatibility}`);
    }

    tests.forEach(test => {
      const testIcon = test.status === 'passed' ? '  ✓' : '  ✗';
      console.log(`${testIcon} ${test.description}`);
      if (test.error) {
        console.log(`      Error: ${test.error}`);
      }
    });

    console.log('');
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, stats) {
  const timestamp = new Date().toISOString();

  let md = '# Electron-to-Web E2E Test Report\n\n';
  md += `**Generated:** ${timestamp}\n\n`;

  md += '## Test Summary\n\n';
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tests | ${stats.total} |\n`;
  md += `| Passed | ${stats.passed} |\n`;
  md += `| Failed | ${stats.failed} |\n`;
  md += `| Pass Rate | ${Math.round(stats.passRate)}% |\n\n`;

  // Group by feature
  const byFeature = {};
  results.forEach(result => {
    if (!byFeature[result.feature]) {
      byFeature[result.feature] = [];
    }
    byFeature[result.feature].push(result);
  });

  md += '## Feature Coverage\n\n';

  for (const [feature, tests] of Object.entries(byFeature)) {
    const allPassed = tests.every(t => t.status === 'passed');
    const icon = allPassed ? '✅' : '❌';

    md += `### ${icon} ${feature}\n\n`;

    if (FEATURE_DETAILS[feature]) {
      const details = FEATURE_DETAILS[feature];
      md += `**Electron API:** \`${details.electronAPI}\`\n\n`;
      md += `**Description:** ${details.description}\n\n`;
      md += `**Compatibility:** ${details.compatibility}\n\n`;

      if (details.electronDocs !== 'N/A') {
        md += `**Electron Docs:** [${details.electronDocs}](${details.electronDocs})\n\n`;
      }
    }

    md += '**Test Cases:**\n\n';
    tests.forEach(test => {
      const testIcon = test.status === 'passed' ? '✅' : '❌';
      md += `- ${testIcon} ${test.description}\n`;
      if (test.error) {
        md += `  - Error: \`${test.error}\`\n`;
      }
    });

    md += '\n';
  }

  md += '## Electron IPC Compatibility Matrix\n\n';
  md += '| Feature | Status | Compatibility | Notes |\n';
  md += '|---------|--------|---------------|-------|\n';

  for (const [feature, tests] of Object.entries(byFeature)) {
    const allPassed = tests.every(t => t.status === 'passed');
    const status = allPassed ? '✅ Pass' : '❌ Fail';
    const details = FEATURE_DETAILS[feature];
    const compat = details ? details.compatibility : 'N/A';
    const testCount = tests.length;

    md += `| ${feature} | ${status} | ${compat} | ${testCount} test${testCount > 1 ? 's' : ''} |\n`;
  }

  md += '\n';

  md += '## Implementation Details\n\n';
  md += '**Transport:** JSON-RPC 2.0 over WebSocket\n\n';
  md += '**Library:** [json-rpc-2.0](https://www.npmjs.com/package/json-rpc-2.0)\n\n';
  md += '**WebSocket Server:** [ws](https://www.npmjs.com/package/ws)\n\n';

  md += '## Limitations\n\n';
  md += '- **Data Types:** Limited to JSON-serializable types (no functions, circular references, etc.)\n';
  md += '- **Synchronous IPC:** `ipcRenderer.sendSync()` is not supported (use `invoke()` instead)\n';
  md += '- **Process Isolation:** No true process isolation like Electron (runs in same Node.js process)\n';
  md += '- **Native APIs:** Electron native APIs (dialog, menu, etc.) require separate implementation\n\n';

  return md;
}

/**
 * Main report generation function
 */
export function generateReport(results) {
  const stats = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
  };
  stats.passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;

  // Console report
  generateConsoleReport(results, stats);

  // Markdown report
  const markdown = generateMarkdownReport(results, stats);
  const reportPath = join(__dirname, '..', 'TEST_REPORT.md');

  try {
    writeFileSync(reportPath, markdown, 'utf8');
    console.log(`📄 Markdown report saved to: TEST_REPORT.md\n`);
  } catch (error) {
    console.error('Failed to save markdown report:', error);
  }

  return stats;
}
