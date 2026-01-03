# Native API Implementation Summary

This document summarizes the native API support added to electron-to-web.

## Overview

electron-to-web now provides comprehensive native API support through a hybrid architecture:
- **Client-side shims** use Web APIs directly (no server required)
- **Server-side handlers** require explicit security configuration

## Implemented APIs

### Client-Side (Pure Web APIs)

#### 1. Clipboard API (`src/renderer/clipboard.ts`)
- **Web API**: `navigator.clipboard`
- **Methods**: writeText, readText, writeHTML, readHTML, writeImage, readImage, clear, isAvailable
- **Limitations**: Requires HTTPS in production

#### 2. Dialog API (`src/renderer/dialog.ts`)
- **Web API**: File System Access API + fallback to `<input type="file">`
- **Methods**: showOpenDialog, showSaveDialog, showMessageBox, showErrorBox
- **Features**:
  - Modern File System Access API for Chrome/Edge
  - Automatic fallback to file input for older browsers
  - Custom modal implementation for complex message boxes

#### 3. Notification API (`src/renderer/notification.ts`)
- **Web API**: Web Notification API
- **Features**: requestPermission, show, event handlers (click, close, error)
- **Limitations**: Requires user permission

#### 4. Screen API (`src/renderer/screen.ts`)
- **Web API**: `window.screen`
- **Methods**: getPrimaryDisplay, getAllDisplays, getDisplayNearestPoint, getDisplayMatching
- **Events**: display-metrics-changed (via resize, orientation, DPI changes)
- **Limitations**:
  - Web can only access primary display
  - getCursorScreenPoint not available (browser security)

#### 5. Shell API - Client Operations (`src/renderer/shell.ts`)
- **openExternal()**: Opens URLs via `window.open()`
- **beep()**: Plays beep sound via Web Audio API

### Server-Side (Requires Security Configuration)

#### 6. Shell API - Server Operations (`src/main/native-handlers.ts`)

**shell:openPath** - Open files in OS default application
- Windows: `start "" "path"`
- macOS: `open "path"`
- Linux: `xdg-open "path"`

**shell:showItemInFolder** - Show file in file manager
- Windows: `explorer /select,"path"`
- macOS: `open -R "path"`
- Linux: `xdg-open "dirname"`

**shell:trashItem** - Move files to trash/recycle bin
- Windows: PowerShell with FileSystem.DeleteFile (SendToRecycleBin)
- macOS: AppleScript with Finder
- Linux: `gio trash "path"`

**app:getPath** - Get system paths
- Supported paths: home, appData, userData, temp, downloads, documents, desktop

## Security Model

### Configuration System (`src/shared/security-config.ts`)

```typescript
interface SecurityConfig {
  allowShellExecution?: boolean;      // shell.openPath, showItemInFolder, trashItem
  allowFileSystemAccess?: boolean;    // Future: fs operations
  allowPathQueries?: boolean;         // app.getPath()
  allowedPaths?: string[];            // Path whitelist
  validateShellCommand?: (command, args) => boolean;
  validateFilePath?: (path) => boolean;
}
```

### Predefined Configs

**DEFAULT_SECURITY_CONFIG**
- All operations disabled by default
- Safe for untrusted environments

**TRUSTED_SECURITY_CONFIG**
- All operations enabled
- For trusted environments like Auto-Claude

### Server Integration (`src/server/create-server.ts`)

```typescript
createWebServer({
  port: 3001,
  security: {
    allowShellExecution: true,
    allowedPaths: ['/home/user/projects'],
    validateShellCommand: (cmd, args) => {
      // Custom validation logic
    }
  }
});
```

## File Structure

```
src/
├── shared/
│   └── security-config.ts        # Security configuration interface & defaults
├── main/
│   ├── index.ts                  # Exports native handlers & security config
│   └── native-handlers.ts        # Server-side IPC handlers
├── renderer/
│   ├── index.ts                  # Exports all client-side APIs
│   ├── clipboard.ts              # Clipboard shim
│   ├── dialog.ts                 # Dialog shim
│   ├── notification.ts           # Notification shim
│   ├── screen.ts                 # Screen shim
│   └── shell.ts                  # Shell shim
└── server/
    └── create-server.ts          # Server setup with security registration

examples/
└── native-apis-example.ts        # Complete usage examples
```

## API Coverage

### Fully Implemented ✅

| API | Methods | Status |
|-----|---------|--------|
| clipboard | writeText, readText, writeHTML, readHTML, writeImage, readImage, clear, isAvailable | ✅ Complete |
| dialog | showOpenDialog, showSaveDialog, showMessageBox, showErrorBox | ✅ Complete |
| Notification | constructor, show, on, once, close, requestPermission, isSupported | ✅ Complete |
| screen | getPrimaryDisplay, getAllDisplays, getDisplayNearestPoint, getDisplayMatching, on | ✅ Complete |
| shell (client) | openExternal, beep | ✅ Complete |
| shell (server) | openPath, showItemInFolder, trashItem | ✅ Complete |
| app | getPath | ✅ Complete |

### Not Implemented (Future Work)

- **Filesystem API**: Reading/writing files requires additional security considerations
- **Process**: spawn, exec, etc. (security-sensitive)
- **Tray**: System tray not available in web
- **Menu**: Native menus not available in web
- **PowerMonitor**: Limited browser APIs
- **Shell shortcuts** (writeShortcutLink, readShortcutLink): Windows-specific, low priority

## Migration Path from Electron

### Before (Electron)
```typescript
import { clipboard, dialog, Notification, shell, screen } from 'electron';

await clipboard.writeText('hello');
const result = await dialog.showOpenDialog({ ... });
```

### After (electron-to-web)
```typescript
import { clipboard, dialog, Notification, shell, screen } from 'electron-to-web/renderer';

await clipboard.writeText('hello');  // Same API!
const result = await dialog.showOpenDialog({ ... });  // Same API!
```

### Server Setup
```typescript
import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';

createWebServer({
  port: 3001,
  security: TRUSTED_SECURITY_CONFIG  // Enable server-side operations
});
```

## Security Considerations

1. **Default Deny**: All server-side operations disabled by default
2. **Explicit Opt-in**: Must configure security settings to enable operations
3. **Path Whitelisting**: Restrict operations to specific directories
4. **Custom Validators**: Provide your own validation logic
5. **Platform-Specific**: Commands adapted for Windows/macOS/Linux
6. **Error Handling**: Clear error messages for denied operations

## Testing

**Status**: Native API tests not yet implemented

**Planned Coverage**:
- Clipboard operations (requires browser clipboard API)
- Dialog fallback behavior
- Notification permission handling
- Screen API responsiveness
- Shell security validation
- Server handler error cases

## Documentation

- ✅ README.md updated with Native APIs section
- ✅ API Reference for each native API
- ✅ Security configuration examples
- ✅ Usage examples in `examples/native-apis-example.ts`

## Future Enhancements

1. **Filesystem API**: Add secure file reading/writing
2. **Custom Plugins**: Allow users to register custom native handlers
3. **Enhanced Security**: Add CSP (Content Security Policy) support
4. **Better Fallbacks**: Improve fallback UX for unsupported browsers
5. **Permission UI**: Built-in UI for requesting permissions
6. **Test Suite**: Comprehensive E2E tests for all native APIs

## Browser Compatibility

| API | Chrome/Edge | Firefox | Safari | Fallback |
|-----|------------|---------|--------|----------|
| Clipboard | ✅ Full | ✅ Full | ✅ Full | N/A |
| Dialog (File Access API) | ✅ Full | ⚠️ Limited | ⚠️ Limited | File input |
| Notification | ✅ Full | ✅ Full | ✅ Full | N/A |
| Screen | ✅ Full | ✅ Full | ✅ Full | N/A |
| Shell (client) | ✅ Full | ✅ Full | ✅ Full | N/A |
| Shell (server) | ✅ Full | ✅ Full | ✅ Full | N/A |

## References

- [Electron Clipboard API](https://www.electronjs.org/docs/latest/api/clipboard)
- [Electron Dialog API](https://www.electronjs.org/docs/latest/api/dialog)
- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
- [Electron Screen API](https://www.electronjs.org/docs/latest/api/screen)
- [Electron Shell API](https://www.electronjs.org/docs/latest/api/shell)
- [Web Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Web Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
