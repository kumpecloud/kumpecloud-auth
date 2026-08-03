#!/bin/sh
# Auth container entrypoint: resolve a writable Postgres host explicitly (node-pg does not
# reliably honor libpq multi-host / target_session_attrs), then seed and start.
set -eu

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
POSTGRES_DB="${POSTGRES_DB:-logto}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
SKIP_DB_SEED="${SKIP_DB_SEED:-0}"
PEER_POSTGRES_IP="${PEER_POSTGRES_IP:-}"
POSTGRES_HOST_IPS="${POSTGRES_HOST_IPS:-}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Ordered host candidates for failover probing (compose DNS first, then literal Nebula IPs).
list_db_hosts() {
  printf '%s\n' "postgres"
  if [ -n "${POSTGRES_HOST_IPS}" ]; then
    old_ifs="${IFS}"
    IFS=','
    # shellcheck disable=SC2086
    set -- ${POSTGRES_HOST_IPS}
    IFS="${old_ifs}"
    for ip in "$@"; do
      ip="$(echo "${ip}" | tr -d '[:space:]')"
      [ -n "${ip}" ] || continue
      [ "${ip}" = "postgres" ] && continue
      printf '%s\n' "${ip}"
    done
  elif [ -n "${PEER_POSTGRES_IP}" ]; then
    printf '%s\n' "${PEER_POSTGRES_IP}"
  fi
}

single_host_db_url() {
  host="$1"
  # URL-encode is omitted; passwords should be alphanumeric for deploy secrets.
  printf 'postgres://%s:%s@%s:%s/%s' \
    "${POSTGRES_USER}" "${POSTGRES_PASSWORD}" "${host}" "${DB_PORT}" "${POSTGRES_DB}"
}

# Probe one host with node-pg; exit 0 writable, 2 in recovery, 1 unreachable/error.
probe_host() {
  host="$1"
  DB_PROBE_URL="$(single_host_db_url "${host}")"
  export DB_PROBE_URL
  node -e "
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.DB_PROBE_URL, connectionTimeoutMillis: 5000 });
    c.connect()
      .then(() => c.query('select pg_is_in_recovery() as r'))
      .then((r) => {
        const recovery = r.rows[0].r === true || r.rows[0].r === 't';
        process.exit(recovery ? 2 : 0);
      })
      .catch(() => process.exit(1))
      .finally(() => c.end().catch(() => {}));
  "
}

# Explicit multi-host failover: try each candidate; set DB_URL to first writable single host.
# Avoids libpq multi-host URLs that node-postgres/slonik may not honor.
resolve_writable_db_url() {
  i=0
  max="${DB_WAIT_MAX_ATTEMPTS:-60}"
  while [ "${i}" -lt "${max}" ]; do
    # shellcheck disable=SC2046
    for host in $(list_db_hosts | awk 'NF && !seen[$0]++'); do
      if probe_host "${host}"; then
        DB_URL="$(single_host_db_url "${host}")"
        export DB_URL
        echo "auth-entrypoint: writable postgres at host=${host}"
        return 0
      fi
      code=$?
      if [ "${code}" = "2" ]; then
        echo "auth-entrypoint: host=${host} is standby (recovery)"
      else
        echo "auth-entrypoint: host=${host} not ready"
      fi
    done
    i=$((i + 1))
    echo "auth-entrypoint: waiting for writable postgres (${i}/${max})"
    sleep 5
  done
  echo "auth-entrypoint: timed out waiting for writable postgres" >&2
  exit 1
}

resolve_writable_db_url
echo "auth-entrypoint: DB_URL set to single writable host (password redacted)"

if [ "${SKIP_DB_SEED}" = "1" ]; then
  echo "auth-entrypoint: SKIP_DB_SEED=1 — skipping seed/alterations"
else
  # Schema on standby arrives via replication; seed runs only when we own a writer.
  npm run cli db seed -- --swe --dapc
  npm run cli db alteration deploy latest
  npm run cli db alteration deploy next
fi

exec npm start
