#!/bin/sh
# PostgreSQL HA entrypoint: bootstrap as primary, clone as standby, or rejoin after failover.
# Env: see ha-common.sh (PEER_POSTGRES_IP, POSTGRES_REPLICATION_*, NODE_NAME, POSTGRES_HBA_ALLOWED_CIDRS)
set -eu

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export PGDATA
PEER="${PEER_POSTGRES_IP:-}"
REPL_USER="${POSTGRES_REPLICATION_USER:-replicator}"
REPL_PASS="${POSTGRES_REPLICATION_PASSWORD:-}"
NODE_NAME="${NODE_NAME:-node}"
export NODE_NAME

# shellcheck source=/dev/null
. /ha-common.sh

if ha_ha_enabled; then
  HA_ENABLED=1
else
  HA_ENABLED=0
fi

log() {
  ha_log "postgres-ha" "$@"
}

local_pg_version_exists() {
  [ -s "${PGDATA}/PG_VERSION" ]
}

wipe_datadir() {
  log "wiping ${PGDATA} for rejoin/clone"
  find "${PGDATA}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
}

clone_from_peer() {
  log "cloning from peer ${PEER} as standby"
  wipe_datadir
  if ! PGPASSWORD="${REPL_PASS}" pg_basebackup \
    -h "${PEER}" \
    -p 5432 \
    -U "${REPL_USER}" \
    -D "${PGDATA}" \
    -Fp \
    -Xs \
    -P \
    -R \
    -S logto_standby; then
    log "clone with slot failed; retrying without slot"
    wipe_datadir
    PGPASSWORD="${REPL_PASS}" pg_basebackup \
      -h "${PEER}" \
      -p 5432 \
      -U "${REPL_USER}" \
      -D "${PGDATA}" \
      -Fp \
      -Xs \
      -P \
      -R
  fi
  if [ -f "${PGDATA}/postgresql.auto.conf" ]; then
    if ! grep -q "primary_conninfo" "${PGDATA}/postgresql.auto.conf" 2>/dev/null; then
      echo "primary_conninfo = 'host=${PEER} port=5432 user=${REPL_USER} password=${REPL_PASS}'" \
        >> "${PGDATA}/postgresql.auto.conf"
    fi
  fi
  touch "${PGDATA}/standby.signal"
  log "standby clone complete"
}

maybe_rejoin() {
  [ "${HA_ENABLED}" = "1" ] || return 0
  ha_peer_is_writable || return 0

  if [ -f "${PGDATA}/standby.signal" ]; then
    log "existing standby data; peer is primary — resume apply"
    return 0
  fi

  log "peer ${PEER} is primary and local is not standby — auto-rejoin"
  clone_from_peer
}

if [ "${HA_ENABLED}" = "1" ]; then
  if ! local_pg_version_exists; then
    if ha_peer_is_writable; then
      clone_from_peer
    else
      log "empty data dir and no writable peer — initializing as primary"
    fi
  else
    maybe_rejoin
  fi
else
  log "HA disabled (set PEER_POSTGRES_IP + POSTGRES_REPLICATION_PASSWORD to enable)"
fi

exec docker-entrypoint.sh postgres \
  -c wal_level=replica \
  -c max_wal_senders=16 \
  -c max_replication_slots=16 \
  -c hot_standby=on \
  -c listen_addresses='*' \
  -c password_encryption=scram-sha-256
