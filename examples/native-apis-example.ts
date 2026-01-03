/**
 * Example: Using Native APIs with Security Configuration
 *
 * This example shows how to use electron-to-web's native API support
 * with proper security configuration for server-side operations.
 */

// ============================================================================
// SERVER SETUP (Main Process)
// ============================================================================

import { createWebServer, TRUSTED_SECURITY_CONFIG } from 'electron-to-web/server';

// Option 1: Fully trusted (for Auto-Claude use case)
const server1 = await createWebServer({
  port: 3001,
  staticDir: './dist',
  security: TRUSTED_SECURITY_CONFIG, // Allows all operations
});

// Option 2: Custom security configuration
const server2 = await createWebServer({
  port: 3001,
  staticDir: './dist',
  security: {
    allowShellExecution: true,
    allowFileSystemAccess: true,
    allowPathQueries: true,
    allowedPaths: [
      '/home/user/projects',  // Only allow access to specific directories
      '/tmp',
    ],
    validateShellCommand: (command, args) => {
      // Custom validation: only allow specific commands
      const allowedCommands = ['open', 'xdg-open', 'explorer'];
      const cmdName = command.split(' ')[0];
      return allowedCommands.includes(cmdName);
    },
    validateFilePath: (path) => {
      // Path validation happens automatically based on allowedPaths
      // But you can add custom validation here
      return !path.includes('..');  // Prevent directory traversal
    },
  },
});

// Option 3: Safe defaults (all dangerous operations disabled)
const server3 = await createWebServer({
  port: 3001,
  staticDir: './dist',
  // No security config = all disabled by default
});

// ============================================================================
// CLIENT USAGE (Renderer Process)
// ============================================================================

import {
  clipboard,
  dialog,
  Notification,
  shell,
  screen
} from 'electron-to-web/renderer';

// --------------------------------------------------------------------------
// Clipboard API (Pure Web API - no server required)
// --------------------------------------------------------------------------

async function clipboardExample() {
  // Write text
  await clipboard.writeText('Hello, World!');

  // Read text
  const text = await clipboard.readText();
  console.log('Clipboard:', text);

  // Write HTML
  await clipboard.writeHTML('<h1>Hello</h1>');

  // Write image
  const imageBlob = await fetch('/image.png').then(r => r.blob());
  await clipboard.writeImage(imageBlob);

  // Check availability
  if (clipboard.isAvailable()) {
    console.log('Clipboard is available');
  }
}

// --------------------------------------------------------------------------
// Dialog API (File System Access API with fallback)
// --------------------------------------------------------------------------

async function dialogExample() {
  // Open file dialog
  const openResult = await dialog.showOpenDialog({
    title: 'Select Files',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'gif'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'txt'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });

  if (!openResult.canceled) {
    console.log('Selected files:', openResult.filePaths);
  }

  // Open directory dialog
  const dirResult = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  // Save dialog
  const saveResult = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath: 'document.pdf',
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
    ],
  });

  if (!saveResult.canceled && saveResult.filePath) {
    console.log('Save to:', saveResult.filePath);
  }

  // Message box
  const msgResult = await dialog.showMessageBox({
    type: 'question',
    title: 'Confirm',
    message: 'Are you sure?',
    detail: 'This action cannot be undone.',
    buttons: ['Yes', 'No', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });

  console.log('User clicked button:', msgResult.response);

  // Error box
  dialog.showErrorBox('Error', 'Something went wrong!');
}

// --------------------------------------------------------------------------
// Notification API (Web Notification API)
// --------------------------------------------------------------------------

async function notificationExample() {
  // Check if supported
  if (Notification.isSupported()) {
    // Request permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // Create notification
      const notif = new Notification({
        title: 'Hello!',
        body: 'This is a notification',
        icon: '/icon.png',
        tag: 'unique-tag',
        silent: false,
      });

      // Listen for events
      notif.on('click', () => {
        console.log('Notification clicked');
      });

      notif.on('close', () => {
        console.log('Notification closed');
      });

      // Show notification
      await notif.show();

      // Close after 5 seconds
      setTimeout(() => notif.close(), 5000);
    }
  }
}

// --------------------------------------------------------------------------
// Shell API (Hybrid - some client, some server)
// --------------------------------------------------------------------------

async function shellExample() {
  // Open external URL (pure client-side)
  await shell.openExternal('https://example.com');

  // Open file in default app (requires server with security enabled)
  try {
    const result = await shell.openPath('/path/to/file.pdf');
    if (result === '') {
      console.log('File opened successfully');
    } else {
      console.error('Error:', result);
    }
  } catch (error) {
    console.error('Shell operation not allowed:', error);
  }

  // Show file in folder (requires server)
  try {
    await shell.showItemInFolder('/path/to/file.txt');
  } catch (error) {
    console.error('Operation not allowed:', error);
  }

  // Move to trash (requires server)
  try {
    await shell.trashItem('/path/to/file.txt');
  } catch (error) {
    console.error('Operation not allowed:', error);
  }

  // Play beep (pure client-side)
  shell.beep();
}

// --------------------------------------------------------------------------
// Screen API (Pure Web API)
// --------------------------------------------------------------------------

function screenExample() {
  // Get primary display
  const primary = screen.getPrimaryDisplay();
  console.log('Screen resolution:', primary.bounds.width, 'x', primary.bounds.height);
  console.log('Work area:', primary.workArea);
  console.log('Scale factor:', primary.scaleFactor);
  console.log('Rotation:', primary.rotation);
  console.log('Touch support:', primary.touchSupport);

  // Get all displays (web only returns primary)
  const displays = screen.getAllDisplays();
  console.log('Number of displays:', displays.length);

  // Listen for display changes
  screen.on('display-metrics-changed', () => {
    console.log('Display metrics changed');
  });
}

// ============================================================================
// SECURITY ERROR HANDLING
// ============================================================================

async function securityErrorExample() {
  try {
    // This will fail if security is not configured
    await shell.openPath('/etc/passwd');
  } catch (error) {
    if (error instanceof Error && error.message.includes('[Security]')) {
      console.error('Security error:', error.message);
      // Inform user that this operation requires server configuration
      await dialog.showErrorBox(
        'Permission Denied',
        'This operation requires server-side permissions. Please configure security settings.'
      );
    }
  }
}

// ============================================================================
// COMPARISON: ELECTRON vs ELECTRON-TO-WEB
// ============================================================================

/**
 * The code is identical for most operations!
 *
 * Electron:
 * ```typescript
 * import { clipboard, dialog, Notification, shell, screen } from 'electron';
 * await clipboard.writeText('hello');
 * const result = await dialog.showOpenDialog({ ... });
 * ```
 *
 * Electron-to-Web:
 * ```typescript
 * import { clipboard, dialog, Notification, shell, screen } from 'electron-to-web/renderer';
 * await clipboard.writeText('hello');  // Same API!
 * const result = await dialog.showOpenDialog({ ... });  // Same API!
 * ```
 *
 * Key differences:
 * 1. Server-side operations require security configuration
 * 2. Some APIs have limitations (e.g., getCursorScreenPoint not available in web)
 * 3. File dialogs use modern File System Access API when available
 */
