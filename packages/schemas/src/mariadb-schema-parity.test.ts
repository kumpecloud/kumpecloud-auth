import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postgresDir = path.resolve(__dirname, '../tables');
const mariadbDir = path.resolve(__dirname, '../tables-mariadb');

const lifecycleFiles = new Set([
  '_before_all.sql',
  '_after_all.sql',
  '_after_each.sql',
  '_functions.sql',
  '_functions_mariadb.sql',
  '_after_each_mariadb.sql',
]);

const parseTableColumns = (sql: string): Map<string, Set<string>> => {
  const tables = new Map<string, Set<string>>();
  const createTableRegex = /create table (\w+)\s*\(([\s\S]*?)\);/gi;
  let match;

  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];

    if (!tableName || !body) {
      continue;
    }

    const columns = new Set<string>();

    for (const line of body.split('\n')) {
      const trimmed = line.trim().replace(/\/\*[\s\S]*?\*\//g, '').trim();

      if (!trimmed || trimmed.startsWith(')')) {
        continue;
      }

      if (/^(primary key|constraint|unique|foreign|check|exclude|references)/i.test(trimmed)) {
        continue;
      }

      // MariaDB-only generated virtual columns for JSON uniqueness indexes.
      if (/\bas\s*\(/i.test(trimmed)) {
        continue;
      }

      const columnMatch = /^([a-z_][a-z0-9_]*)\s+\S+/i.exec(trimmed);

      if (columnMatch?.[1]) {
        columns.add(columnMatch[1].toLowerCase());
      }
    }

    tables.set(tableName.toLowerCase(), columns);
  }

  return tables;
};

describe('MariaDB schema parity', () => {
  it('every Postgres table file has a MariaDB counterpart with matching columns', async () => {
    const postgresFiles = (await fs.readdir(postgresDir)).filter(
      (file) => file.endsWith('.sql') && !lifecycleFiles.has(file)
    );

    for (const file of postgresFiles) {
      const pgSql = await fs.readFile(path.join(postgresDir, file), 'utf8');
      const mariaPath = path.join(mariadbDir, file);

      await expect(fs.stat(mariaPath)).resolves.toBeDefined();

      const mariaSql = await fs.readFile(mariaPath, 'utf8');
      const pgTables = parseTableColumns(pgSql);
      const mariaTables = parseTableColumns(mariaSql);

      expect([...mariaTables.keys()].sort()).toEqual([...pgTables.keys()].sort());

      for (const [table, pgColumns] of pgTables.entries()) {
        const mariaColumns = mariaTables.get(table);
        expect(mariaColumns, `missing table ${table} in ${file}`).toBeDefined();
        expect([...mariaColumns!].sort()).toEqual([...pgColumns].sort());
      }
    }
  });
});
