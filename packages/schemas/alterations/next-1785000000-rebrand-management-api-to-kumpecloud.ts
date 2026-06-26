import { sql } from '@silverhand/slonik';

import type { AlterationScript } from '../lib/types/alteration.js';

const managementApiProductName = 'KumpeCloud Management API';
const managementApiAccessRoleName = 'KumpeCloud Management API access';
const managementApiAccessRoleDescription =
  'This default role grants access to the KumpeCloud Auth management API.';
const meApiProductName = 'KumpeCloud Me API';

const alteration: AlterationScript = {
  up: async (pool) => {
    await pool.query(sql`
      update resources
      set
        indicator = replace(indicator, '.logto.app', '.kumpe.app'),
        name = replace(name, 'Logto Management API', ${managementApiProductName}),
        updated_at = now()
      where indicator like 'https://%.logto.app/%'
        or name like '%Logto Management API%'
        or name = 'Logto Me API';
    `);

    await pool.query(sql`
      update resources
      set name = ${meApiProductName}, updated_at = now()
      where name = 'Logto Me API';
    `);

    await pool.query(sql`
      update roles
      set
        name = ${managementApiAccessRoleName},
        description = ${managementApiAccessRoleDescription},
        updated_at = now()
      where name = 'Logto Management API access';
    `);
  },
  down: async (pool) => {
    await pool.query(sql`
      update resources
      set
        indicator = replace(indicator, '.kumpe.app', '.logto.app'),
        name = replace(name, ${managementApiProductName}, 'Logto Management API'),
        updated_at = now()
      where indicator like 'https://%.kumpe.app/%';
    `);

    await pool.query(sql`
      update resources
      set name = 'Logto Me API', updated_at = now()
      where name = ${meApiProductName};
    `);

    await pool.query(sql`
      update roles
      set
        name = 'Logto Management API access',
        description = 'This default role grants access to the Logto management API.',
        updated_at = now()
      where name = ${managementApiAccessRoleName};
    `);
  },
};

export default alteration;
