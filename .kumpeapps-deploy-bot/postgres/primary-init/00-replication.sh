#!/bin/sh
# Runs only on first primary init (empty PGDATA) via /docker-entrypoint-initdb.d.
# Creates the replication role used by standby nodes for pg_basebackup / streaming.
# Scoped pg_hba: only peer / POSTGRES_HOST_IPS / POSTGRES_HBA_ALLOWED_CIDRS (never 0.0.0.0/0).
set -eu

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export NODE_NAME="${NODE_NAME:-node}"

# Initdb scripts run with scripts copied into the image path; ha-common is mounted at /ha-common.sh
if [ -f /ha-common.sh ]; then
  # shellcheck source=/dev/null
  . /ha-common.sh
else
  echo "postgres-ha: /ha-common.sh missing; using inline minimal setup" >&2
  REPL_USER="${POSTGRES_REPLICATION_USER:-replicator}"
  REPL_PASS="${POSTGRES_REPLICATION_PASSWORD:-}"
  if [ -z "${REPL_PASS}" ]; then
    exit 0
  fi
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${REPL_USER}') THEN
    CREATE ROLE ${REPL_USER} WITH REPLICATION LOGIN PASSWORD '${REPL_PASS}';
  END IF;
END
\$\$;
EOSQL
  exit 0
fi

if [ -z "${POSTGRES_REPLICATION_PASSWORD:-}" ]; then
  ha_log "postgres-ha" "POSTGRES_REPLICATION_PASSWORD unset; skipping replicator role"
  exit 0
fi

ha_ensure_replicator_role socket
ha_ensure_pg_hba_replication
ha_log "postgres-ha" "replication role '$(ha_repl_user)' ready"
