#!/bin/bash
set -e

DATA_DIR="/var/lib/postgresql/data"

if [ -z "$(ls -A "$DATA_DIR")" ]; then
    echo "Waiting for master database to be ready..."
    until pg_isready -h db-master -p 5432 -U myuser; do
        sleep 1
    done

    echo "Master is up. Pulling initial base backup..."
    PGPASSWORD=replicapassword pg_basebackup -h db-master -D "$DATA_DIR" -U replicator -vP -R
fi

# FIX: Force strict 0700 Linux folder permissions required by PostgreSQL
chmod 700 "$DATA_DIR"
chown -R postgres:postgres "$DATA_DIR"

exec gosu postgres postgres