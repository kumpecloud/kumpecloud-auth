import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createDatabasePool,
  DatabaseDialect,
  isMariaDatabasePool,
  isPostgresDatabasePool,
  parseDatabaseUrl,
  type MariaDatabasePool,
  type PostgresDatabasePool,
} from '@logto/database';
import { sql } from '@silverhand/slonik';

import { getPathInModule, consoleLog } from '../../utils.js';

export type MigrationOptions = {
  fromUrl: string;
  toUrl: string;
  dryRun?: boolean;
  batchSize?: number;
  tables?: string[];
  force?: boolean;
};

export type TableMigrationPlan = {
  table: string;
  initOrder: number;
};

export type MigrationVerification = {
  table: string;
  sourceCount: number;
  targetCount: number;
  sourceChecksum: string;
  targetChecksum: string;
  ok: boolean;
};

const getInitOrder = (sqlText: string): number => {
  const matched = /\/\*\s*init_order\s*=\s*([\d.]+)\s*\*\//.exec(sqlText)?.[1];
  return matched ? Number(matched) : Number.POSITIVE_INFINITY;
};

export const getTableMigrationPlan = async (): Promise<TableMigrationPlan[]> => {
  const tableDirectory = getPathInModule('@logto/schemas', 'tables');
  const files = await readdir(tableDirectory);
  const plans: TableMigrationPlan[] = [];

  for (const file of files.filter((name) => name.endsWith('.sql') && !name.startsWith('_'))) {
    const sqlText = await readFile(path.join(tableDirectory, file), 'utf8');
    const tableName = file.replace(/\.sql$/, '');
    plans.push({ table: tableName, initOrder: getInitOrder(sqlText) });
  }

  return plans.sort((a, b) => a.initOrder - b.initOrder || a.table.localeCompare(b.table));
};

const checksumRows = (rows: ReadonlyArray<Record<string, unknown>>) => {
  let hash = 0;

  const normalized = rows
    .map((row) => JSON.stringify(row, Object.keys(row).sort()))
    .sort();

  for (const entry of normalized) {
    for (const char of entry) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
  }

  return hash.toString(16);
};

const transformRow = (row: Record<string, unknown>) => {
  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      transformed[key] = value.toISOString();
      continue;
    }

    if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
      transformed[key] = JSON.stringify(value);
      continue;
    }

    transformed[key] = value;
  }

  return transformed;
};

export class MigrationService {
  async verifyTargetSchema(targetPool: MariaDatabasePool, plan: TableMigrationPlan[]) {
    if (!isMariaDatabasePool(targetPool)) {
      throw new Error('Target pool must be MariaDB');
    }

    const missing: string[] = [];

    for (const { table } of plan) {
      const { rows } = await targetPool.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
        [table]
      );

      if (Number(rows[0]?.count ?? 0) === 0) {
        missing.push(table);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Target MariaDB schema is missing ${missing.length} table(s): ${missing.slice(0, 5).join(', ')}${
          missing.length > 5 ? '...' : ''
        }. Run seed + alteration deploy first.`
      );
    }

    consoleLog.succeed(`Verified ${plan.length} target tables exist`);
  }

  async run(options: MigrationOptions) {
    const fromDialect = parseDatabaseUrl(options.fromUrl).dialect;
    const toDialect = parseDatabaseUrl(options.toUrl).dialect;

    if (fromDialect !== DatabaseDialect.Postgres || toDialect !== DatabaseDialect.MariaDB) {
      throw new Error('Migration supports --from postgres:// and --to mariadb:// only');
    }

    const sourcePool = await createDatabasePool(options.fromUrl);
    const targetPool = await createDatabasePool(options.toUrl);

    if (!isPostgresDatabasePool(sourcePool) || !isMariaDatabasePool(targetPool)) {
      throw new Error('Unexpected pool types for pg-to-mariadb migration');
    }

    const postgresSource = sourcePool as PostgresDatabasePool;
    const mariaTarget = targetPool as MariaDatabasePool;

    const plan = (await getTableMigrationPlan()).filter(({ table }) =>
      options.tables ? options.tables.includes(table) : true
    );

    if (!options.dryRun) {
      await this.verifyTargetSchema(mariaTarget, plan);
    }

    consoleLog.info(
      `${options.dryRun ? '[dry-run] ' : ''}Migrating ${plan.length} tables from Postgres to MariaDB`
    );

    const verifications: MigrationVerification[] = [];

    for (const { table } of plan) {
      const { rows: countRows } = await postgresSource.query<{ count: string }>(sql`
        select count(*)::text as count from ${sql.identifier([table])}
      `);
      const sourceCount = Number(countRows[0]?.count ?? 0);

      if (options.dryRun) {
        consoleLog.plain(`  ${table}: ${sourceCount} rows`);
        continue;
      }

      if (options.force) {
        await mariaTarget.query(`DELETE FROM \`${table}\``);
      } else {
        const { rows: existingRows } = await mariaTarget.query<{ count: number }>(
          `SELECT COUNT(*) as count FROM \`${table}\``
        );

        if (Number(existingRows[0]?.count ?? 0) > 0) {
          throw new Error(
            `Table ${table} already has data. Use --force to overwrite or filter with --tables.`
          );
        }
      }

      const { rows } = await postgresSource.query<Record<string, unknown>>(sql`
        select * from ${sql.identifier([table])}
      `);

      if (rows.length === 0) {
        verifications.push({
          table,
          sourceCount: 0,
          targetCount: 0,
          sourceChecksum: checksumRows([]),
          targetChecksum: checksumRows([]),
          ok: true,
        });
        continue;
      }

      const columns = Object.keys(rows[0]!);
      const batchSize = options.batchSize ?? 500;

      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize).map(transformRow);
        const placeholders = batch
          .map(() => `(${columns.map(() => '?').join(', ')})`)
          .join(', ');
        const values = batch.flatMap((row: Record<string, unknown>) =>
          columns.map((column) => row[column] ?? null)
        );

        await mariaTarget.query(
          `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ${placeholders}`,
          values
        );
      }

      const { rows: targetCountRows } = await mariaTarget.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM \`${table}\``
      );
      const targetCount = Number(targetCountRows[0]?.count ?? 0);
      const { rows: targetRows } = await mariaTarget.query<Record<string, unknown>>(
        `SELECT * FROM \`${table}\``
      );

      const verification: MigrationVerification = {
        table,
        sourceCount,
        targetCount,
        sourceChecksum: checksumRows(rows),
        targetChecksum: checksumRows(targetRows),
        ok: sourceCount === targetCount && checksumRows(rows) === checksumRows(targetRows),
      };

      verifications.push(verification);

      if (!verification.ok) {
        throw new Error(
          `Verification failed for ${table}: counts ${sourceCount} vs ${targetCount}, checksums ${verification.sourceChecksum} vs ${verification.targetChecksum}`
        );
      }

      consoleLog.succeed(`Migrated ${table} (${sourceCount} rows)`);
    }

    await postgresSource.end();
    await mariaTarget.end();

    consoleLog.succeed(`Migration complete: ${verifications.length} tables verified`);

    return verifications;
  }
}

export const migratePgToMariaDb = async (options: MigrationOptions) =>
  new MigrationService().run(options);
