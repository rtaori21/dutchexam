#!/usr/bin/env bash
# Convenience launcher: build (if needed) + start the stack + print URLs.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker Desktop: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not running. Start Docker Desktop and try again."
  exit 1
fi

mkdir -p data resumes config
[[ -f backend/.env ]] || cp backend/.env.example backend/.env

echo "==> Building images (first run takes a few minutes)…"
docker compose build

echo "==> Starting stack…"
docker compose up -d

echo
echo "Backend:   http://localhost:8787  (Swagger: /docs)"
echo "Dashboard: http://localhost:8788"
echo
echo "Tail logs:   docker compose logs -f"
echo "Stop:        docker compose down"
