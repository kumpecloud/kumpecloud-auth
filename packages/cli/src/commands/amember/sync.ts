import {
  createSlonikAMemberSyncContext,
  loadAMemberSyncConfigFromEnv,
  resolveAMemberSyncConfig,
  runAMemberSync,
} from '@logto/plugin-amember-sync';
import { amemberSyncStoredConfigGuard } from '@logto/schemas';
import { sql } from '@silverhand/slonik';
import type { CommandModule } from 'yargs';

import { createPoolFromConfig } from '../../database.js';
import { consoleLog } from '../../utils.js';

const sync: CommandModule<Record<string, never>, { tenant?: string }> = {
  command: 'sync',
  describe: 'Run a one-off sync from aMember into Kumpecloud Auth',
  builder: (yargs) =>
    yargs.option('tenant', {
      describe: 'Tenant ID to sync (defaults to configured tenant)',
      type: 'string',
    }),
  handler: async ({ tenant }) => {
    const pool = await createPoolFromConfig();
    const tenantId = tenant ?? 'default';

    try {
      const { rows } = await pool.query<{ value: unknown }>(sql`
        select value
        from logto_configs
        where tenant_id = ${tenantId}
          and key = 'amemberSync'
      `);
      const stored = rows[0]?.value
        ? amemberSyncStoredConfigGuard.parse(rows[0].value)
        : undefined;
      const config = resolveAMemberSyncConfig(tenantId, stored) ?? loadAMemberSyncConfigFromEnv();

      if (!config?.enabled) {
        consoleLog.fatal(
          'aMember sync is not enabled. Configure it in Console under Settings → aMember sync, or set AMEMBER_SYNC_ENABLED=true.'
        );
      }

      const stats = await runAMemberSync({
        config: { ...config, tenantId },
        context: createSlonikAMemberSyncContext(pool, tenantId, {
          syncPasswords: config.syncPasswords,
        }),
        logger: consoleLog,
      });

      consoleLog.succeed(
        `Sync complete: ${stats.productsCreated} roles created, ${stats.usersCreated} users created, ${stats.usersUpdated} users updated, ${stats.usersSkipped} skipped, ${stats.roleAssignmentsAdded} role assignments added`
      );
    } finally {
      await pool.end();
    }
  },
};

export default sync;
