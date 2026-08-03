#!/bin/sh
# Shared helpers for KumpeCloud Auth Postgres HA scripts.
# Sourced by ha-entrypoint.sh, failover-watch.sh, and primary-init (where applicable).
#
# Env used:
#   PEER_POSTGRES_IP
#   POSTGRES_HOST_IPS              comma-separated Nebula IPs
#   POSTGRES_HBA_ALLOWED_CIDRS     optional extra CIDRs for pg_hba (e.g. 10.10.0.0/16)
#   POSTGRES_REPLICATION_USER      default replicator
#   POSTGRES_REPLICATION_PASSWORD
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
#   NODE_NAME
#   PGDATA

# shellcheck disable=SC2034
HA_COMMON_LOADED=1

ha_node_name() {
  echo "${NODE_NAME:-node}"
}

ha_log() {
  # Usage: ha_log <component> <message...>
  component="$1"
  shift
  echo "${component}[$(ha_node_name)]: $*"
}

ha_repl_user() {
  echo "${POSTGRES_REPLICATION_USER:-replicator}"
}

ha_ha_enabled() {
  [ -n "${PEER_POSTGRES_IP:-}" ] && [ -n "${POSTGRES_REPLICATION_PASSWORD:-}" ]
}

# Collect CIDRs allowed for replication (and only replication) in pg_hba.
# Prefer explicit peer / host IPs as /32 and optional POSTGRES_HBA_ALLOWED_CIDRS.
# Never emits 0.0.0.0/0 or ::/0.
ha_hba_cidrs() {
  cidrs=""
  append_cidr() {
    c="$1"
    [ -n "${c}" ] || return 0
    case " ${cidrs} " in
      *" ${c} "*) return 0 ;;
    esac
    cidrs="${cidrs}${cidrs:+ }${c}"
  }

  if [ -n "${PEER_POSTGRES_IP:-}" ]; then
    case "${PEER_POSTGRES_IP}" in
      *:*) append_cidr "${PEER_POSTGRES_IP}/128" ;;
      *) append_cidr "${PEER_POSTGRES_IP}/32" ;;
    esac
  fi

  if [ -n "${POSTGRES_HOST_IPS:-}" ]; then
    old_ifs="${IFS}"
    IFS=','
    # shellcheck disable=SC2086
    set -- ${POSTGRES_HOST_IPS}
    IFS="${old_ifs}"
    for ip in "$@"; do
      ip="$(echo "${ip}" | tr -d '[:space:]')"
      [ -n "${ip}" ] || continue
      case "${ip}" in
        *:*) append_cidr "${ip}/128" ;;
        */*) append_cidr "${ip}" ;;
        *) append_cidr "${ip}/32" ;;
      esac
    done
  fi

  if [ -n "${POSTGRES_HBA_ALLOWED_CIDRS:-}" ]; then
    old_ifs="${IFS}"
    IFS=','
    # shellcheck disable=SC2086
    set -- ${POSTGRES_HBA_ALLOWED_CIDRS}
    IFS="${old_ifs}"
    for c in "$@"; do
      c="$(echo "${c}" | tr -d '[:space:]')"
      [ -n "${c}" ] || continue
      case "${c}" in
        0.0.0.0/0|::/0)
          echo "ha-common: refusing wide-open HBA CIDR ${c}" >&2
          continue
          ;;
      esac
      append_cidr "${c}"
    done
  fi

  echo "${cidrs}"
}

ha_peer_ready() {
  peer="${PEER_POSTGRES_IP:-}"
  [ -n "${peer}" ] || return 1
  pg_isready -h "${peer}" -p 5432 -U "$(ha_repl_user)" -t 3 >/dev/null 2>&1
}

ha_peer_is_writable() {
  ha_peer_ready || return 1
  peer="${PEER_POSTGRES_IP}"
  repl_user="$(ha_repl_user)"
  result="$(PGPASSWORD="${POSTGRES_REPLICATION_PASSWORD}" psql -h "${peer}" -p 5432 -U "${repl_user}" -d postgres -tAc \
    "SELECT CASE WHEN pg_is_in_recovery() THEN 'standby' ELSE 'primary' END" 2>/dev/null || true)"
  [ "${result}" = "primary" ]
}

# Ensure replication role + physical slot exist (run against local primary as superuser).
# Arg: "socket" for initdb local socket; default "postgres" for compose service name.
ha_ensure_replicator_role() {
  target="${1:-postgres}"
  pguser="${POSTGRES_USER:-postgres}"
  repl_user="$(ha_repl_user)"
  repl_pass="${POSTGRES_REPLICATION_PASSWORD:-}"
  [ -n "${repl_pass}" ] || return 0

  if [ "${target}" = "socket" ]; then
    psql_base="psql -v ON_ERROR_STOP=1 --username ${pguser} --dbname ${POSTGRES_DB:-postgres}"
  else
    psql_base="psql -h ${target} -U ${pguser} -d postgres -v ON_ERROR_STOP=1"
  fi

  # shellcheck disable=SC2086
  ${psql_base} <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${repl_user}') THEN
    CREATE ROLE ${repl_user} WITH REPLICATION LOGIN PASSWORD '${repl_pass}';
  ELSE
    ALTER ROLE ${repl_user} WITH REPLICATION LOGIN PASSWORD '${repl_pass}';
  END IF;
END
\$\$;
SELECT pg_create_physical_replication_slot('logto_standby', true)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_replication_slots WHERE slot_name = 'logto_standby'
);
EOSQL
}

# Append scoped replication lines to pg_hba and reload. No host all all 0.0.0.0/0.
# Relies on image defaults for local Docker app access.
ha_ensure_pg_hba_replication() {
  pgdata="${PGDATA:-/var/lib/postgresql/data}"
  hba="${pgdata}/pg_hba.conf"
  repl_user="$(ha_repl_user)"
  [ -f "${hba}" ] || return 0

  cidrs="$(ha_hba_cidrs)"
  if [ -z "${cidrs}" ]; then
    ha_log "ha-common" "no PEER/POSTGRES_HOST_IPS/POSTGRES_HBA_ALLOWED_CIDRS; skipping pg_hba replication rules"
    return 0
  fi

  changed=0
  for cidr in ${cidrs}; do
    line="host replication ${repl_user} ${cidr} scram-sha-256"
    if ! grep -Fqx "${line}" "${hba}" 2>/dev/null; then
      echo "${line}" >> "${hba}"
      changed=1
    fi
  done

  [ "${changed}" = "1" ] || return 0

  # Reload when server is up (failover-watch). Initdb path reloads on start.
  if [ "${1:-}" = "reload" ]; then
    pguser="${POSTGRES_USER:-postgres}"
    psql -h postgres -U "${pguser}" -d postgres -c "SELECT pg_reload_conf();" >/dev/null 2>&1 || true
  fi
  ha_log "ha-common" "pg_hba replication rules updated for: ${cidrs}"
}
