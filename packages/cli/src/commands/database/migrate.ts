import type { CommandModule } from 'yargs';

import { consoleLog } from '../../utils.js';

import { migratePgToMariaDb } from './migrate-pg-to-mariadb.js';
import { resolveMigrateUrls } from './resolve-migrate-urls.js';

const redactUrl = (url: string) => url.replace(/:([^:@/]+)@/, ':***@');

const migrate: CommandModule<
  unknown,
  {
    from?: string;
    to?: string;
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
  describe:
    'Migrate data from PostgreSQL to MariaDB. Defaults: --to from DB_URL / MIGRATE_TO_URL; --from from MIGRATE_FROM_URL / POSTGRES_URL / POSTGRES_*.',
  builder: (yargs) =>
    yargs
      .option('from', {
        describe:
          'Source PostgreSQL URL (default: MIGRATE_FROM_URL, POSTGRES_URL, or postgres:// from POSTGRES_*)',
        type: 'string',
      })
      .option('to', {
        describe: 'Target MariaDB URL (default: MIGRATE_TO_URL or DB_URL)',
        type: 'string',
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
    const { fromUrl, toUrl } = resolveMigrateUrls({ from, to });
    const parseTableList = (value?: string) =>
      value
        ?.split(',')
        .map((table) => table.trim())
        .filter(Boolean);

    consoleLog.info(`Migrate from ${redactUrl(fromUrl)}`);
    consoleLog.info(`Migrate to   ${redactUrl(toUrl)}`);

    await migratePgToMariaDb({
      fromUrl,
      toUrl,
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
