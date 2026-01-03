# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-01-03

### Fixed
- Modernized GitHub Release workflow to use gh CLI instead of deprecated actions
- Fixed README ASCII art spacing issues

## [0.1.2] - 2026-01-03

### Added
- Test results now published to GitHub Actions summary page

## [0.1.1] - 2026-01-03

### Added
- NPM Trusted Publishing (OIDC) for secure automated releases
- Complete CI/CD documentation (TRUSTED_PUBLISHING.md, QUICK_START.md)

## [0.1.0] - 2026-01-03

### Added
- Initial release of electron-to-web
- Drop-in replacement for Electron IPC using JSON-RPC over WebSocket
- Full support for `ipcRenderer.invoke()` - Request/response pattern
- Full support for `webContents.send()` - Server-to-client notifications
- `BrowserWindow` shim for webContents API
- Automatic connection management with reconnection support
- Comprehensive E2E test suite (18 tests, 100% passing)
- Complete documentation:
  - Getting started guide (README.md)
  - Architecture documentation (ARCHITECTURE.md)
  - Feature parity comparison (FEATURE_PARITY.md)
  - Test report with coverage details

### Features
- **Core IPC APIs**
  - `ipcMain.handle(channel, handler)` - Register request handler
  - `ipcRenderer.invoke(channel, ...args)` - Send request, wait for response
  - `ipcRenderer.on(channel, listener)` - Listen for notifications
  - `ipcRenderer.send(channel, ...args)` - Send notification
  - `webContents.send(channel, ...args)` - Send notification to client

- **Connection Management**
  - Auto-reconnection with exponential backoff
  - Message queuing during disconnection
  - Multi-client support
  - Graceful connection lifecycle handling

- **Data Types**
  - Full JSON serialization support
  - Handles all JSON-compatible types
  - Complex nested objects and arrays
  - Special characters and unicode

- **Error Handling**
  - Graceful error responses
  - Server stability on malformed requests
  - JSON-RPC error format

### Technical Details
- TypeScript with full type definitions
- ESM module support
- JSON-RPC 2.0 protocol
- WebSocket transport (ws library)
- Express HTTP server
- Node.js 18+ required

### Documentation
- Complete API reference
- Migration guide from Electron
- Working examples
- Automated test suite with reporting

[Unreleased]: https://github.com/lsadehaan/electron-to-web/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lsadehaan/electron-to-web/releases/tag/v0.1.0
