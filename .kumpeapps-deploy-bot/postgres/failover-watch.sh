#!/bin/sh
# Promote local Postgres when the peer primary is unreachable.
# Split-brain: log loudly; lower-priority node should be restarted so ha-entrypoint rejoins.
#
# Env: see ha-common.sh plus NODE_PRIORITY, FAIL_THRESHOLD, POLL_INTERVAL_SEC
set -eu

PEER="${PEER_POSTGRES_IP:-}"
REPL_PASS="${POSTGRES_REPLICATION_PASSWORD:-}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
export PGPASSWORD
NODE_NAME="${NODE_NAME:-node}"
export NODE_NAME
NODE_PRIORITY="${NODE_PRIORITY:-100}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-5}"
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-5}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export PGDATA
failures=0

# shellcheck source=/dev/null
. /ha-common.sh

log() {
  ha_log "failover-watch" "$@"
}

if [ -z "${PEER}" ] || [ -z "${REPL_PASS}" ]; then
  log "HA not configured; idling"
  exec tail -f /dev/null
fi

local_in_recovery() {
  psql -h postgres -U "${PGUSER}" -d postgres -tAc "SELECT pg_is_in_recovery()" 2>/dev/null | grep -qx t
}

local_is_ready() {
  pg_isready -h postgres -U "${PGUSER}" -t 3 >/dev/null 2>&1
}

promote_local() {
  log "promoting local postgres to primary"
  psql -h postgres -U "${PGUSER}" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_promote();"
}

ensure_primary_replication() {
  local_in_recovery && return 0
  ha_ensure_replicator_role postgres
  ha_ensure_pg_hba_replication reload
}

log "started (peer=${PEER} priority=${NODE_PRIORITY} threshold=${FAIL_THRESHOLD})"

while true; do
  sleep "${POLL_INTERVAL_SEC}"

  if ! local_is_ready; then
    log "local postgres not ready"
    continue
  fi

  if local_in_recovery; then
    if ha_peer_ready; then
      failures=0
    else
      failures=$((failures + 1))
      log "peer unreachable (${failures}/${FAIL_THRESHOLD})"
      if [ "${failures}" -ge "${FAIL_THRESHOLD}" ]; then
        promote_local || log "promote failed"
        failures=0
        sleep 10
        ensure_primary_replication || true
      fi
    fi
    continue
  fi

  failures=0
  ensure_primary_replication || true

  if ha_peer_is_writable; then
    if [ "${NODE_PRIORITY}" -lt 100 ]; then
      log "CRITICAL SPLIT-BRAIN: peer is also primary; local priority ${NODE_PRIORITY} should rejoin — restart the postgres service on this node"
    else
      log "CRITICAL SPLIT-BRAIN: peer is also primary; local priority ${NODE_PRIORITY} retains writer — restart peer postgres so it rejoins"
    fi
  fi
done
