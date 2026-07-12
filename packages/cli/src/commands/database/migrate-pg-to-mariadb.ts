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
import decamelize from 'decamelize';

import { getPathInModule, consoleLog } from '../../utils.js';

export type MigrationOptions = {
  fromUrl: string;
  toUrl: string;
  dryRun?: boolean;
  batchSize?: number;
  tables?: string[];
  skipTables?: string[];
  resumeFrom?: string;
  skipExisting?: boolean;
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

/** Slonik camelCases keys; MariaDB DDL uses snake_case column names. */
export const toSnakeCaseColumn = (key: string) => (key.includes('_') ? key : decamelize(key));

const isTimestampField = (key: string) =>
  key === 'date' || key.endsWith('At') || key.endsWith('_at');

/** MariaDB DATETIME rejects ISO-8601 (`…T…Z`); use SQL datetime literals instead. */
export const toMariaDbDateTime = (value: Date | number | string): string => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const iso = date.toISOString(); // 2026-07-09T00:46:16.154Z

  return iso.replace('T', ' ').replace(/Z$/i, '');
};

const canonicalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJson(entry));
  }

  if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeJson(entry)])
    );
  }

  return value;
};

export const transformValueForMariaDb = (key: string, value: unknown) => {
  if (value instanceof Date) {
    return toMariaDbDateTime(value);
  }

  // Postgres/Slonik sometimes returns epoch millis for timestamp columns.
  if (isTimestampField(key) && typeof value === 'number' && Number.isFinite(value)) {
    return toMariaDbDateTime(value);
  }

  if (isTimestampField(key) && typeof value === 'string' && /T|\s/.test(value)) {
    const parsed = Date.parse(value);

    if (!Number.isNaN(parsed)) {
      return toMariaDbDateTime(parsed);
    }
  }

  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return JSON.stringify(canonicalizeJson(value));
  }

  return value;
};

/**
 * Normalize a cell for cross-dialect checksums (Postgres vs MariaDB reads diverge on
 * bool/int, Date vs string, and JSON key order).
 */
export const normalizeValueForChecksum = (key: string, value: unknown): unknown => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // MariaDB TINYINT(1) / boolean columns come back as 0/1.
  if (value === 0 || value === 1) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('hex');
  }

  if (value instanceof Date) {
    return toMariaDbDateTime(value);
  }

  if (isTimestampField(key) && typeof value === 'number' && Number.isFinite(value)) {
    return toMariaDbDateTime(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed === '') {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const asIso = trimmed.includes('T')
        ? trimmed
        : `${trimmed.replace(' ', 'T')}${/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed) ? '' : 'Z'}`;
      const parsed = Date.parse(asIso);

      if (!Number.isNaN(parsed)) {
        return toMariaDbDateTime(parsed);
      }
    }

    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
      try {
        return JSON.stringify(canonicalizeJson(JSON.parse(trimmed) as unknown));
      } catch {
        return trimmed;
      }
    }

    if (trimmed === 'true') {
      return 1;
    }

    if (trimmed === 'false') {
      return 0;
    }

    return trimmed;
  }

  if (typeof value === 'object') {
    return JSON.stringify(canonicalizeJson(value));
  }

  return value;
};

/** Normalize values + snake_case keys for stable Postgres↔MariaDB checksums. */
export const transformRow = (row: Record<string, unknown>) => {
  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    transformed[toSnakeCaseColumn(key)] = normalizeValueForChecksum(key, value);
  }

  return transformed;
};

/** Prepare a row for MariaDB INSERT: snake_case columns + normalized values. */
export const transformRowForMariaInsert = (row: Record<string, unknown>) => {
  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    transformed[toSnakeCaseColumn(key)] = transformValueForMariaDb(key, value);
  }

  return transformed;
};

const normalizeRows = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: readonly string[]
) =>
  rows
    .map((row) => {
      const normalized = transformRow(row);
      const keys = columns ?? Object.keys(normalized).sort();
      const filtered = Object.fromEntries(keys.map((key) => [key, normalized[key] ?? null]));

      return JSON.stringify(filtered, [...keys]);
    })
    .sort();

const checksumNormalizedRows = (normalizedRows: readonly string[]) => {
  let hash = 0;

  for (const entry of normalizedRows) {
    for (const char of entry) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
  }

  return hash.toString(16);
};

export const checksumRows = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: readonly string[]
) => checksumNormalizedRows(normalizeRows(rows, columns));

export const filterMigrationPlan = (plan: TableMigrationPlan[], options: MigrationOptions) => {
  let filtered = plan.filter(({ table }) => (options.tables ? options.tables.includes(table) : true));

  if (options.skipTables?.length) {
    const skip = new Set(options.skipTables);
    filtered = filtered.filter(({ table }) => !skip.has(table));
  }

  if (options.resumeFrom) {
    const resumeIndex = filtered.findIndex(({ table }) => table === options.resumeFrom);

    if (resumeIndex >= 0) {
      filtered = filtered.slice(resumeIndex);
    }
  }

  return filtered;
};

export const computePaginatedTableChecksum = async (
  pool: PostgresDatabasePool | MariaDatabasePool,
  table: string,
  dialect: DatabaseDialect,
  pageSize: number,
  columns?: readonly string[]
) => {
  const normalizedRows: string[] = [];
  let offset = 0;

  while (true) {
    const rows =
      dialect === DatabaseDialect.Postgres
        ? (
            await (pool as PostgresDatabasePool).query<Record<string, unknown>>(sql`
              select * from ${sql.identifier([table])}
              order by 1
              limit ${pageSize} offset ${offset}
            `)
          ).rows
        : (
            await (pool as MariaDatabasePool).query<Record<string, unknown>>(
              `SELECT * FROM \`${table}\` ORDER BY 1 LIMIT ? OFFSET ?`,
              [pageSize, offset]
            )
          ).rows;

    if (rows.length === 0) {
      break;
    }

    normalizedRows.push(...normalizeRows(rows, columns));
    offset += pageSize;
  }

  // Sort across pages so checksum is independent of page boundaries.
  normalizedRows.sort();

  return {
    count: normalizedRows.length,
    checksum: checksumNormalizedRows(normalizedRows),
  };
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

    const plan = filterMigrationPlan(await getTableMigrationPlan(), options);
    const pageSize = options.batchSize ?? 500;

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

      const { rows: existingRows } = await mariaTarget.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM \`${table}\``
      );
      const existingTargetCount = Number(existingRows[0]?.count ?? 0);

      if (options.skipExisting && existingTargetCount > 0) {
        const sourceSample = await postgresSource.query<Record<string, unknown>>(sql`
          select * from ${sql.identifier([table])} limit 1
        `);
        const sourceColumns =
          sourceSample.rows[0] === undefined
            ? undefined
            : Object.keys(transformRow(sourceSample.rows[0])).sort();
        const sourceChecksum = await computePaginatedTableChecksum(
          postgresSource,
          table,
          DatabaseDialect.Postgres,
          pageSize,
          sourceColumns
        );
        const targetChecksum = await computePaginatedTableChecksum(
          mariaTarget,
          table,
          DatabaseDialect.MariaDB,
          pageSize,
          sourceColumns
        );

        if (
          sourceCount === targetChecksum.count &&
          sourceChecksum.checksum === targetChecksum.checksum
        ) {
          consoleLog.warn(`Skipping ${table} (already migrated and verified)`);
          verifications.push({
            table,
            sourceCount,
            targetCount: targetChecksum.count,
            sourceChecksum: sourceChecksum.checksum,
            targetChecksum: targetChecksum.checksum,
            ok: true,
          });
          continue;
        }
      }

      if (options.force) {
        await mariaTarget.query(`DELETE FROM \`${table}\``);
      } else if (existingTargetCount > 0) {
        throw new Error(
          `Table ${table} already has data. Use --force to overwrite, --skip-existing to resume verified tables, or filter with --tables.`
        );
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

      const columns = Object.keys(transformRowForMariaInsert(rows[0]!));
      // Compare only physical source columns — MariaDB virtual/generated columns must not affect checksums.
      const sourceColumns = Object.keys(transformRow(rows[0]!)).sort();

      for (let index = 0; index < rows.length; index += pageSize) {
        const batch = rows.slice(index, index + pageSize).map(transformRowForMariaInsert);
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

      const sourceChecksum = checksumRows(rows, sourceColumns);
      const targetVerification = await computePaginatedTableChecksum(
        mariaTarget,
        table,
        DatabaseDialect.MariaDB,
        pageSize,
        sourceColumns
      );

      const verification: MigrationVerification = {
        table,
        sourceCount,
        targetCount: targetVerification.count,
        sourceChecksum,
        targetChecksum: targetVerification.checksum,
        ok: sourceCount === targetVerification.count && sourceChecksum === targetVerification.checksum,
      };

      verifications.push(verification);

      if (!verification.ok) {
        throw new Error(
          `Verification failed for ${table}: counts ${sourceCount} vs ${targetVerification.count}, checksums ${verification.sourceChecksum} vs ${verification.targetChecksum}`
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
