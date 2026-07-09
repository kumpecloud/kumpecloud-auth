/** Baseline marker — MariaDB schema is applied via `tables-mariadb/` seed, not historical Postgres alterations. */
const alteration = {
    up: async () => {
        // No-op: baseline schema is created by `pnpm cli db seed` against tables-mariadb/.
    },
    down: async () => {
        // Baseline removal is not supported.
    },
};
export default alteration;
