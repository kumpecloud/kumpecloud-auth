#!/usr/bin/env node
/**
 * Sanitize packages/schemas/tables-mariadb/*.sql for MariaDB compatibility.
 * Safe to re-run. Prefer virtual columns over expression/partial indexes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, '../tables-mariadb');

/** Remove CHECK constraints that use subqueries (unsupported on MariaDB). */
const stripSubqueryChecks = (content) =>
  content
    .replace(
      /,\s*\n\s*(?:\/\*\*[\s\S]*?\*\/\s*\n\s*)?constraint\s+\w+\s*\n\s*check\s*\(\([\s\S]*?\)\s*=\s*'[^']*'\)/gi,
      ''
    )
    .replace(
      /,\s*\n\s*(?:\/\*\*[\s\S]*?\*\/\s*\n\s*)?constraint\s+\w+\s*\n\s*check\s*\(\([\s\S]*?\)\s+in\s*\([^)]*\)\)/gi,
      ''
    )
    .replace(/,\s*\n\s*\/\*\*[^*]*application type[^*]*\*\/\s*(?=\n\);)/gi, '');

const stripBrinIndexes = (content) =>
  content.replace(
    /(?:--[^\n]*\n)*create index \w+\s*\n\s*on \w+ using brin\s*\([^)]+\);\s*/gi,
    ''
  );

const stripEmptyIndexes = (content) =>
  content.replace(/create(?:\s+unique)?\s+index\s+\w+\s*\n\s*on\s+\w+\s*;\s*/gi, '');

const fixUsersLowerIndex = (content, fileName) => {
  if (fileName !== 'users.sql') {
    return content;
  }

  let result = content.replace(
    /\/\*\s*Supports case-insensitive username lookups[\s\S]*?create index users__tenant_lower_username\s*\n\s*on users \(tenant_id, lower\(username\)\);\s*/i,
    ''
  );

  if (!result.includes('username_lower')) {
    result = result.replace(
      /(updated_at DATETIME\(3\) not null DEFAULT CURRENT_TIMESTAMP\(3\),)/i,
      `$1
  username_lower varchar(128) as (lower(username)) virtual,`
    );
    result += `
/* Supports case-insensitive username lookups and case-flip conflict detection. */
create index users__tenant_lower_username
  on users (tenant_id, username_lower);
`;
  }

  return result;
};

const sanitizeFile = (fileName, content) => {
  let result = content;
  result = stripSubqueryChecks(result);
  result = stripBrinIndexes(result);
  result = stripEmptyIndexes(result);
  result = fixUsersLowerIndex(result, fileName);
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
};

const main = async () => {
  const files = (await fs.readdir(targetDir)).filter((file) => file.endsWith('.sql'));
  let changed = 0;

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    const original = await fs.readFile(filePath, 'utf8');
    const next = sanitizeFile(file, original);

    if (next !== original) {
      await fs.writeFile(filePath, next);
      changed += 1;
      console.log(`sanitized ${file}`);
    }
  }

  console.log(`Done. Updated ${changed}/${files.length} files.`);
};

await main();
