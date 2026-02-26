#!/bin/bash
# Backup PostgreSQL database from running Docker container
# Usage: bash scripts/backup_db.sh
# Cron (daily at 03:00): 0 3 * * * /opt/staleks/scripts/backup_db.sh

set -e

BACKUP_DIR=/opt/staleks/backups
mkdir -p "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/staleks_erp_$(date +%Y%m%d_%H%M%S).sql.gz"

docker exec staleks_postgres pg_dump -U staleks staleks_erp | gzip > "$FILENAME"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup saved: $FILENAME"
