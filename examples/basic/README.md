# Basic Example

Minimal demonstration of electron-to-web.

## Setup

1. Build the library:
   ```bash
   cd ../..
   npm install
   npm run build
   ```

2. Start the server:
   ```bash
   cd examples/basic
   mkdir -p public
   cp client.html public/index.html
   node server.js
   ```

3. Open browser:
   ```
   http://localhost:3001
   ```

4. Click buttons and watch the console!

## What it demonstrates

- `ipcRenderer.invoke()` - Request/response (ping, add)
- `ipcMain.handle()` - Handler registration
- `webContents.send()` - Server → Client notifications
- `ipcRenderer.on()` - Event listeners
