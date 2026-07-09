#!/bin/bash
set -e

DATA_DIR="/var/lib/postgresql/data"

if [ -z "$(ls -A "$DATA_DIR")" ]; then
    echo "Waiting for the master node (${MASTER_HOST}) to accept connections..."
    until pg_isready -h "$MASTER_HOST" -p 5432 -U myuser; do
        sleep 1
    done

    echo "Master is up. Pulling initial base backup..."
    PGPASSWORD=replicapassword pg_basebackup -h "$MASTER_HOST" -D "$DATA_DIR" -U replicator -vP -R
fi

# FIX: Force strict 0700 Linux folder permissions required by PostgreSQL
chmod 700 "$DATA_DIR"
chown -R postgres:postgres "$DATA_DIR"

exec gosu postgres postgres