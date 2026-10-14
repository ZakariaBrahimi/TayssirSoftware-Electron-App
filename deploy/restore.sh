#!/usr/bin/env bash
# Restores the database from a backup, then restarts the app.
#   sudo ./deploy/restore.sh                         lists the backups on the server
#   sudo ./deploy/restore.sh mizan-20261014-033000-auto.db
#   sudo ./deploy/restore.sh /path/to/copy.db        a file from deploy/backups or elsewhere
# The database being replaced is kept in the backups as "pre-restore".
set -euo pipefail
cd "$(dirname "$0")"
if [ $# -eq 0 ]; then
  docker compose exec -T app node admin.mjs db:restore
  exit 0
fi
ref=$1
if [ -f "$ref" ]; then
  docker compose cp "$ref" app:/tmp/restore.db >/dev/null
  ref=/tmp/restore.db
fi
read -rp "Replace the live database with $1? Shops lose what changed since then. [y/N] " ok
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "Canceled."; exit 1; }
docker compose exec -T app node admin.mjs db:restore "$ref"
docker compose restart app
echo "Restored. The app is restarting."
