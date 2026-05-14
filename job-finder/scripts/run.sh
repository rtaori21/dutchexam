#!/usr/bin/env bash
# One-shot launcher: starts FastAPI backend (8787) + Next.js dashboard (3737) together.
# Stops both with Ctrl-C (the trap below kills the whole process group).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d backend/.venv ]]; then
  echo "==> Creating Python venv"
  python3 -m venv backend/.venv
fi
# shellcheck disable=SC1091
source backend/.venv/bin/activate
echo "==> Ensuring backend deps installed"
pip install -q --upgrade pip
pip install -q -e backend

if [[ ! -d frontend/node_modules ]]; then
  echo "==> Installing frontend deps"
  (cd frontend && npm install --silent)
fi

if [[ ! -f backend/.env ]]; then
  echo "==> First run: copy backend/.env.example -> backend/.env and fill in keys"
  cp backend/.env.example backend/.env
fi

trap 'kill 0' EXIT
echo "==> Starting backend on http://localhost:8787 (docs at /docs)"
( cd backend && uvicorn app.main:app --reload --port 8787 ) &
echo "==> Starting frontend on http://localhost:3737"
( cd frontend && npm run dev ) &
wait
