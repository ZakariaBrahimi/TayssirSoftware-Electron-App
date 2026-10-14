#!/usr/bin/env bash
# Takes a snapshot and copies the database backups out of the Docker volume
# to deploy/backups (30 kept), then to RCLONE_REMOTE when set in deploy/.env.
# install.sh runs it every night.
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T app node admin.mjs db:backup
mkdir -p backups
chmod 700 backups
docker compose cp app:/data/backups/. backups/ >/dev/null
ls -1t backups/*.db 2>/dev/null | tail -n +31 | xargs -r rm -f
remote=$(sed -n 's/^RCLONE_REMOTE=//p' .env 2>/dev/null || true)
if [ -n "$remote" ]; then
  rclone copy backups "$remote" --max-age 48h
fi
echo "$(date -Is) backups: $(ls backups/*.db | wc -l) in $(pwd)/backups${remote:+, copied to $remote}"
