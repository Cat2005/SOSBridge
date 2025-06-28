#!/bin/bash

echo "🔍 Looking for Next.js development processes..."

# Kill Next.js dev server processes
pkill -f "next dev" 2>/dev/null && echo "✅ Killed 'next dev' processes" || echo "ℹ️  No 'next dev' processes found"

# Kill Node.js processes that might be running Next.js
pkill -f "node.*next" 2>/dev/null && echo "✅ Killed Node.js Next.js processes" || echo "ℹ️  No Node.js Next.js processes found"

# Kill any processes on port 3000 (default Next.js port)
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Killed processes on port 3000" || echo "ℹ️  No processes found on port 3000"

# Kill any WebSocket-related processes
pkill -f "ws" 2>/dev/null && echo "✅ Killed WebSocket processes" || echo "ℹ️  No WebSocket processes found"

echo "🧹 Cleanup complete!"
echo "💡 You can now run 'npm run dev' to start fresh" 