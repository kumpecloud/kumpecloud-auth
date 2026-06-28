import { sql } from '@silverhand/slonik';

import type { AlterationScript } from '../lib/types/alteration.js';

const alteration: AlterationScript = {
  up: async (pool) => {
    await pool.query(sql`
      alter table account_centers
        add column gravatar_enabled boolean not null default false;
    `);
  },
  down: async (pool) => {
    await pool.query(sql`
      alter table account_centers
        drop column gravatar_enabled;
    `);
  },
};

export default alteration;
