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
  { name: 'bytea type', pattern: /\bbytea\b/i },
  { name: 'postgres cast operator', pattern: /::/ },
  { name: 'timestamptz type', pattern: /\btimestamptz\b/i },
  { name: 'jsonb type', pattern: /\bjsonb\b/i },
  { name: 'brin index', pattern: /using\s+brin\b/i },
  { name: 'gin index', pattern: /using\s+gin\b/i },
  {
    name: 'partial index where clause',
    pattern: /create\s+(?:unique\s+)?index[\s\S]*?\n\s+where\s+/i,
  },
  {
    name: 'functional lower()/upper() index expression',
    pattern: /create\s+(?:unique\s+)?index[\s\S]*?\b(?:lower|upper)\s*\(/i,
  },
  {
    name: 'subquery CHECK constraint',
    pattern: /check\s*\(\s*\(\s*select\b/i,
  },
  {
    name: 'unquoted reserved column identifier',
    pattern:
      /^\s+(key|value|usage|date|rank|order|groups|system|check|index|match|mod|range|read|row|rows|interval)\s+(varchar|text|JSON|boolean|bigint|int|DATETIME|longblob)/im,
  },
  {
    name: 'non-unique set_updated_at trigger name',
    pattern: /CREATE TRIGGER set_updated_at\b/i,
  },
];

const assertIdentifiersWithinLimit = (file: string, content: string) => {
  const patterns = [
    /create(?:\s+unique)?\s+index\s+`?([a-zA-Z0-9_]+)`?/gi,
    /constraint\s+`?([a-zA-Z0-9_]+)`?/gi,
    /CREATE TRIGGER\s+`?([a-zA-Z0-9_]+)`?/gi,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1]!;

      if (name.includes('name')) {
        // lifecycle templates use ${name}
        continue;
      }

      expect(
        name.length,
        `${file} identifier "${name}" exceeds MariaDB's 64-char limit`
      ).toBeLessThanOrEqual(64);
    }
  }
};

const assertUniqueTriggerNames = async (files: string[]) => {
  const seen = new Map<string, string>();

  for (const file of files) {
    const content = await fs.readFile(path.join(mariadbDir, file), 'utf8');

    for (const match of content.matchAll(/CREATE TRIGGER (\w+)/gi)) {
      const name = match[1]!.toLowerCase();

      if (name.includes('${')) {
        continue;
      }

      expect(seen.has(name), `duplicate trigger ${name} in ${file} and ${seen.get(name)}`).toBe(
        false
      );
      seen.set(name, file);
    }
  }
};

const assertCreateTableClosed = (file: string, content: string) => {
  const match = /create table \w+\s*\(/i.exec(content);

  if (!match || match.index === undefined) {
    return;
  }

  let depth = 0;
  let started = false;

  for (let index = match.index; index < content.length; index += 1) {
    const char = content[index];

    if (char === '(') {
      depth += 1;
      started = true;
    } else if (char === ')') {
      depth -= 1;

      if (started && depth === 0) {
        const after = content.slice(index + 1).trimStart();
        expect(after.startsWith(';'), `${file} create table must end with );`).toBe(true);
        return;
      }
    }
  }

  expect.fail(`${file} create table never closed`);
};

describe('MariaDB DDL syntax', () => {
  it('does not contain postgres-only operators, types, or unsupported index forms', async () => {
    const files = (await fs.readdir(mariadbDir)).filter((file) => file.endsWith('.sql'));

    for (const file of files) {
      const content = await fs.readFile(path.join(mariadbDir, file), 'utf8');

      for (const { name, pattern } of postgresOnlyPatterns) {
        expect(content, `${file} contains postgres-only ${name}`).not.toMatch(pattern);
      }

      assertCreateTableClosed(file, content);
      assertIdentifiersWithinLimit(file, content);
    }

    await assertUniqueTriggerNames(files);
  });
});
