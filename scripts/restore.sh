#!/bin/sh
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  echo "Example: $0 /backups/orderplat_20261012_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' does not exist."
  exit 1
fi

echo "[$(date)] Restoring database from: $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | psql -h "${PGHOST:-db}" -U "${PGUSER:-postgres}" "${PGDATABASE:-orderplat}"

echo "[$(date)] Database restoration completed successfully."
