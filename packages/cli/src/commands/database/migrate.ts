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
    skipTables?: string;
    resumeFrom?: string;
    skipExisting?: boolean;
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
        describe: 'Rows per insert batch and verification page size',
        type: 'number',
        default: 500,
      })
      .option('tables', {
        describe: 'Comma-separated table filter',
        type: 'string',
      })
      .option('skip-tables', {
        describe: 'Comma-separated tables to skip',
        type: 'string',
      })
      .option('resume-from', {
        describe: 'Resume migration starting at this table',
        type: 'string',
      })
      .option('skip-existing', {
        describe: 'Skip tables that already match source row count and checksum',
        type: 'boolean',
        default: false,
      })
      .option('force', {
        describe: 'Truncate target tables before copying',
        type: 'boolean',
        default: false,
      }),
  handler: async ({
    from,
    to,
    dryRun,
    batchSize,
    tables,
    skipTables,
    resumeFrom,
    skipExisting,
    force,
  }) => {
    const parseTableList = (value?: string) =>
      value
        ?.split(',')
        .map((table) => table.trim())
        .filter(Boolean);

    await migratePgToMariaDb({
      fromUrl: from,
      toUrl: to,
      dryRun,
      batchSize,
      tables: parseTableList(tables),
      skipTables: parseTableList(skipTables),
      resumeFrom,
      skipExisting,
      force,
    });
  },
};

export default migrate;
