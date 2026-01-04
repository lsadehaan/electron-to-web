#!/bin/bash
#
# Build script for web version
# Copies files to web-dist and prepares for deployment
#

echo "Building web version..."

# Create web-dist directory
mkdir -p web-dist

# Copy HTML (use web version)
cp index.web.html web-dist/index.html

# Copy CSS
cp styles.css web-dist/

# Copy renderer (unchanged)
cp renderer.js web-dist/

# Create a bundled preload for web
# For now just copy it - in production you'd want to bundle
cp preload.web.js web-dist/preload.js

echo "✅ Build complete! Files in web-dist/"
echo ""
echo "Next steps:"
echo "1. cd web-server && npm install"
echo "2. npm start"
echo "3. Open http://localhost:3001"
