import { noop } from '@silverhand/essentials';
import type { CommandModule } from 'yargs';

import { migratePgToMariaDb } from './migrate-pg-to-mariadb.js';

const migrate: CommandModule<
  unknown,
  {
    from: string;
    to: string;
    dryRun?: boolean;
    batchSize?: number;
    tables?: string;
    force?: boolean;
  }
> = {
  command: 'migrate',
  describe: 'Migrate data from PostgreSQL to MariaDB',
  builder: (yargs) =>
    yargs
      .option('from', {
        describe: 'Source PostgreSQL URL',
        type: 'string',
        demandOption: true,
      })
      .option('to', {
        describe: 'Target MariaDB URL',
        type: 'string',
        demandOption: true,
      })
      .option('dry-run', {
        describe: 'Report migration plan without writing',
        type: 'boolean',
        default: false,
      })
      .option('batch-size', {
        describe: 'Rows per insert batch',
        type: 'number',
        default: 500,
      })
      .option('tables', {
        describe: 'Comma-separated table filter',
        type: 'string',
      })
      .option('force', {
        describe: 'Allow re-run (future: truncate targets)',
        type: 'boolean',
        default: false,
      }),
  handler: async ({ from, to, dryRun, batchSize, tables, force }) => {
    await migratePgToMariaDb({
      fromUrl: from,
      toUrl: to,
      dryRun,
      batchSize,
      tables: tables?.split(',').map((table) => table.trim()).filter(Boolean),
      force,
    });
  },
};

export default migrate;
