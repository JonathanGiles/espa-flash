#!/bin/bash

# ESP Flasher - Local Development Server
# This script starts a simple HTTP server to run the flasher locally

PORT=${1:-8000}

echo "🚀 Starting ESP Flasher on http://localhost:$PORT"
echo "📝 Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "Using custom Python 3 server with CORS proxy..."
    python3 serve.py $PORT
elif command -v python &> /dev/null; then
    echo "Using custom Python server with CORS proxy..."
    python serve.py $PORT
else
    echo "❌ Python not found. Please install Python or use another method:"
    echo "   - Node.js: npx serve . -l $PORT"
    echo "   - PHP: php -S localhost:$PORT"
    exit 1
fi
