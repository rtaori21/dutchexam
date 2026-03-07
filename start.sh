#!/bin/bash
cd "$(dirname "$0")"

echo "Starting Dutch Learning App..."
npm run dev &
SERVER_PID=$!

sleep 3
echo "Opening in Chrome..."
open -a "Google Chrome" http://localhost:5173

echo "App is running! Press Ctrl+C to stop."
wait $SERVER_PID
