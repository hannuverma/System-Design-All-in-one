#!/bin/bash
set -e

echo "host replication replicator all md5" >> "$PGDATA/pg_hba.conf"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicapassword';
EOSQL