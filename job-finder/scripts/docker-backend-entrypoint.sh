#!/usr/bin/env bash
# First-boot helper: create backend/.env from .env.example if missing so the
# container starts cleanly on a fresh machine. The user can edit either
# locally or via the /env page in the dashboard once running.
set -euo pipefail

ENV_FILE="/app/backend/.env"
EXAMPLE="/app/backend/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$EXAMPLE" ]]; then
    echo "[entrypoint] backend/.env missing — seeding from .env.example"
    cp "$EXAMPLE" "$ENV_FILE"
  else
    echo "[entrypoint] backend/.env missing and no example found — creating empty"
    : > "$ENV_FILE"
  fi
fi

mkdir -p /app/data /app/data/output
exec "$@"
