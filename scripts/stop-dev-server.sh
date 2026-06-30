#!/usr/bin/env bash
# Stop Next.js started for smoke/E2E — npm run start leaves next-server on :3000.
set +e

if [ -f /tmp/next.pid ]; then
  kill "$(cat /tmp/next.pid)" 2>/dev/null
  rm -f /tmp/next.pid
fi

pkill -f "next start" 2>/dev/null
pkill -f "next-server" 2>/dev/null

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 | xargs -r kill -9 2>/dev/null
fi

sleep 2

if curl -sf http://localhost:3000/api/health/live >/dev/null 2>&1; then
  echo "WARN: port 3000 still responding after stop-dev-server"
  exit 1
fi

echo "Port 3000 free"
