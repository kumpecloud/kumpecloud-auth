import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mariadbDir = path.resolve(__dirname, '../tables-mariadb');

const postgresOnlyPatterns = [
  { name: 'json text operator', pattern: /->>/ },
  { name: 'json key existence operator', pattern: /\?\s+'/ },
  { name: 'autovacuum settings', pattern: /autovacuum_/i },
  { name: 'timestamptz type', pattern: /\btimestamptz\b/i },
  { name: 'jsonb type', pattern: /\bjsonb\b/i },
  { name: 'partial index where clause', pattern: /create\s+(?:unique\s+)?index[\s\S]*?\n\s+where\s+/i },
];

describe('MariaDB DDL syntax', () => {
  it('does not contain postgres-only operators or types', async () => {
    const files = (await fs.readdir(mariadbDir)).filter((file) => file.endsWith('.sql'));

    for (const file of files) {
      const content = await fs.readFile(path.join(mariadbDir, file), 'utf8');

      for (const { name, pattern } of postgresOnlyPatterns) {
        expect(content, `${file} contains postgres-only ${name}`).not.toMatch(pattern);
      }
    }
  });
});
