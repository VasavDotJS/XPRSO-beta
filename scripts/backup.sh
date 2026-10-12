#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/orderplat_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting PostgreSQL database backup..."
pg_dump -h "${PGHOST:-db}" -U "${PGUSER:-postgres}" "${PGDATABASE:-orderplat}" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# Prune backups older than 14 days
find "$BACKUP_DIR" -type f -name "orderplat_*.sql.gz" -mtime +14 -exec rm {} +
echo "[$(date)] Retained rolling 14-day backup history."
