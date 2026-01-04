# Build Configuration Guide

This guide provides detailed build configurations for migrating Electron apps to web using electron-to-web. We'll cover Vite, Webpack, and best practices for bundling.

## Table of Contents

- [Why You Need a Bundler](#why-you-need-a-bundler)
- [Vite Configuration (Recommended)](#vite-configuration-recommended)
- [Webpack Configuration](#webpack-configuration)
- [File Structure](#file-structure)
- [Common Build Scripts](#common-build-scripts)
- [Troubleshooting](#troubleshooting)

---

## Why You Need a Bundler

Browsers can't resolve Node.js-style module imports like:
```javascript
import { ipcRenderer } from 'electron-to-web/renderer';
import { Client } from 'json-rpc-2.0';
```

A bundler (Vite, Webpack, etc.) transforms these into browser-compatible code by:
1. Resolving npm package imports
2. Bundling all dependencies into a single file
3. Transpiling modern JavaScript if needed
4. Optimizing for production

---

## Vite Configuration (Recommended)

Vite is fast, modern, and easy to configure. Here's a complete setup:

### Installation

```bash
npm install --save-dev vite@5.4.11
```

**Note**: If using Node.js < 20.19, use Vite 5.x (not 6.x/7.x) to avoid version compatibility issues.

### Complete vite.config.js

```javascript
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: '.',

  build: {
    outDir: 'web-dist',
    emptyOutDir: true,  // Clean output directory

    rollupOptions: {
      // Multiple entry points
      input: {
        main: resolve(__dirname, 'index.web.html'),
        preload: resolve(__dirname, 'preload.web.js')
      },

      output: {
        // Control output filenames
        entryFileNames: (chunkInfo) => {
          // Don't hash the preload file for easy reference
          if (chunkInfo.name === 'preload') {
            return 'preload.js';
          }
          return '[name]-[hash].js';
        },

        // Separate vendor chunks
        manualChunks: {
          vendor: ['json-rpc-2.0']
        }
      }
    },

    // Source maps for debugging
    sourcemap: process.env.NODE_ENV === 'development'
  },

  resolve: {
    alias: {
      // Alias electron-to-web imports to local build
      'electron-to-web/renderer': resolve(__dirname, '../../dist/renderer/index.js'),

      // Or if installed from npm:
      // 'electron-to-web/renderer': 'electron-to-web/dist/renderer/index.js'
    }
  },

  // Development server (optional)
  server: {
    port: 5173,
    proxy: {
      // Proxy WebSocket to backend during dev
      '/ipc': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
});
```

### HTML Configuration

Your `index.web.html` should load scripts from the build:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <!-- Vite will bundle these -->
  <script type="module" src="preload.web.js"></script>
  <script src="renderer.js"></script>
</body>
</html>
```

After build, Vite transforms this to:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <script type="module" crossorigin src="/preload.js"></script>
  <link rel="stylesheet" href="/assets/main-abc123.css">
</head>
<body>
  <div id="app"></div>
  <script src="/renderer.js"></script>
</body>
</html>
```

### Package.json Scripts

```json
{
  "name": "my-electron-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "electron .",
    "dev:web": "vite",
    "build:web": "vite build && npm run post-build",
    "post-build": "npm run copy-files && npm run rename-html",
    "copy-files": "cp renderer.js web-dist/ && cp renderer-wrapper.js web-dist/",
    "rename-html": "cd web-dist && mv index.web.html index.html",
    "preview": "vite preview",
    "start:server": "node web-server/server.js"
  },
  "devDependencies": {
    "vite": "^5.4.11"
  }
}
```

---

## Webpack Configuration

If you prefer Webpack, here's a configuration:

### Installation

```bash
npm install --save-dev webpack webpack-cli html-webpack-plugin
```

### webpack.config.js

```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',

  entry: {
    preload: './preload.web.js',
    renderer: './renderer.js'
  },

  output: {
    path: path.resolve(__dirname, 'web-dist'),
    filename: '[name].js',
    clean: true
  },

  resolve: {
    alias: {
      'electron-to-web/renderer': path.resolve(__dirname, '../../dist/renderer/index.js')
    }
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.web.html',
      filename: 'index.html',
      chunks: ['preload', 'renderer']
    })
  ],

  devServer: {
    port: 8080,
    proxy: {
      '/ipc': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
};
```

---

## File Structure

Recommended structure for web version:

```
my-electron-app/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Electron preload
│   └── renderer.js          # Shared renderer logic
├── web-server/
│   ├── server.js            # Web server using electron-to-web
│   └── package.json
├── web-dist/                # Build output (generated)
│   ├── index.html
│   ├── preload.js           # Bundled
│   ├── renderer.js
│   └── assets/
├── public/                  # Static assets (not bundled)
│   └── images/
├── index.html               # Electron version
├── index.web.html           # Web version template
├── preload.web.js           # Web-specific preload
├── vite.config.js
└── package.json
```

### Separate Preload Files

**preload.js** (Electron):
```javascript
const { ipcRenderer } = require('electron');

window.api = {
  openFile: () => ipcRenderer.invoke('dialog:openFile')
};
```

**preload.web.js** (Web):
```javascript
import { ipcRenderer, dialog } from 'electron-to-web/renderer';

window.api = {
  // Use client-side dialog, not IPC
  openFile: async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    return result;
  }
};
```

---

## Common Build Scripts

### Development Workflow

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "node web-server/server.js",
    "dev:client": "vite",

    "build": "npm run build:web && npm run build:server",
    "build:web": "vite build && npm run post-build",
    "build:server": "echo 'No server build needed for Node.js'",

    "post-build": "node scripts/post-build.js"
  }
}
```

### Post-Build Script

**scripts/post-build.js**:
```javascript
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(__dirname, '../web-dist');

async function postBuild() {
  console.log('Running post-build tasks...');

  // 1. Copy non-bundled files
  await fs.copyFile(
    path.join(__dirname, '../renderer-wrapper.js'),
    path.join(webDist, 'renderer-wrapper.js')
  );

  // 2. Rename HTML if needed
  const webHtml = path.join(webDist, 'index.web.html');
  const indexHtml = path.join(webDist, 'index.html');

  if (await fs.access(webHtml).then(() => true).catch(() => false)) {
    await fs.rename(webHtml, indexHtml);
  }

  // 3. Copy assets
  await fs.cp(
    path.join(__dirname, '../public'),
    path.join(webDist, 'public'),
    { recursive: true }
  );

  console.log('✓ Post-build complete');
}

postBuild().catch(console.error);
```

---

## Troubleshooting

### Issue: "Cannot find module 'electron-to-web/renderer'"

**Solution**: Check your alias configuration:

```javascript
// vite.config.js
resolve: {
  alias: {
    'electron-to-web/renderer': resolve(__dirname, '../../dist/renderer/index.js')
    // Adjust path based on your setup
  }
}
```

### Issue: Build succeeds but app doesn't load

**Check**:
1. Open browser DevTools Console for errors
2. Verify index.html exists in web-dist/
3. Check that preload.js was bundled (should be ~20KB, not 1KB)
4. Ensure script tags are correct in HTML

### Issue: "Failed to resolve module specifier"

This means bundler didn't run. The browser is trying to load unbundled files.

**Solution**: Make sure you're serving files from `web-dist/` (built), not from source directory.

### Issue: Vite version errors

```
Vite 7.x requires Node.js 20.19+ or 22.12+
```

**Solution**: Downgrade Vite:
```bash
npm install --save-dev vite@5.4.11
```

### Issue: Files disappear after rebuild

Vite's `emptyOutDir: true` deletes everything before build.

**Solution**: Copy files in post-build script (see above).

---

## Performance Optimization

### Code Splitting

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['json-rpc-2.0'],
          ui: ['./src/components/ui'],
        }
      }
    }
  }
});
```

### Tree Shaking

Make sure you're using ES modules (not CommonJS) for better tree shaking:

```javascript
// ✓ Good - tree-shakeable
import { ipcRenderer } from 'electron-to-web/renderer';

// ✗ Bad - includes everything
const electronToWeb = require('electron-to-web/renderer');
```

### Minification

```javascript
// vite.config.js
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.logs in production
      }
    }
  }
});
```

---

## Next Steps

- Review [Common Pitfalls](./COMMON_PITFALLS.md) for issues to avoid
- Check [Migration Guide](./MIGRATION_GUIDE.md) for step-by-step migration
- See [example projects](./examples/) for working configurations

---

**Need help?** Open an issue: https://github.com/anthropics/electron-to-web/issues
