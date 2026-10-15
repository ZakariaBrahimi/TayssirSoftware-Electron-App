#!/usr/bin/env bash
# Updates the server to the latest code:  sudo ./deploy/update.sh
# Takes a backup first; database migrations run when the new version starts
# (with their own pre-migration copy).
set -euo pipefail
cd "$(dirname "$0")"
git -C .. pull --ff-only
docker compose exec -T app node admin.mjs db:backup || echo "Backup skipped (app not running)"
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
