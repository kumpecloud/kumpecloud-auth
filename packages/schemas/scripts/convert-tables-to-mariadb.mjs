#!/usr/bin/env node
/**
 * Mechanical Postgres → MariaDB DDL conversion for packages/schemas/tables-mariadb/
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(__dirname, '../tables');
const targetDir = path.resolve(__dirname, '../tables-mariadb');

const enumDefinitions = new Map();

const extractEnums = (content) => {
  const enumRegex = /create type (\w+) as enum \(([^)]+)\)/gi;
  let match;

  while ((match = enumRegex.exec(content)) !== null) {
    const [, name, values] = match;
    enumDefinitions.set(
      name.toLowerCase(),
      values.split(',').map((value) => value.trim().replace(/^'|'$/g, ''))
    );
  }
};

const convertEnumType = (typeName) => {
  const values = enumDefinitions.get(typeName.toLowerCase());

  if (!values) {
    return typeName;
  }

  const maxLen = Math.max(...values.map((value) => value.length));

  return `varchar(${Math.max(maxLen, 16)})`;
};

const convertEnumColumns = (content) => {
  let result = content;

  for (const [enumName, values] of enumDefinitions.entries()) {
    const maxLen = Math.max(...values.map((value) => value.length), 16);
    const varcharType = `varchar(${Math.max(maxLen, 16)})`;
    const columnPattern = new RegExp(
      `((?:^|[\\n,])\\s*)([a-z_][a-z0-9_]*)\\s+${enumName}\\b`,
      'gi'
    );

    result = result.replace(columnPattern, `$1$2 ${varcharType}`);
  }

  return result;
};

const convertContent = (fileName, content) => {
  if (fileName === '_functions.sql') {
    return `/* init_order = 0.5 */

/** MariaDB trigger helpers — set_tenant_id uses session variable @logto_tenant_id when set by TenantGuard. */
/* no_after_each */
`;
  }

  if (fileName === '_after_each.sql') {
    return `/* MariaDB: triggers only — no RLS. Tenant isolation via TenantGuard + @logto_tenant_id session. */

CREATE TRIGGER \${name}_set_tenant_id BEFORE INSERT ON \${name}
FOR EACH ROW
BEGIN
  IF NEW.tenant_id IS NULL AND @logto_tenant_id IS NOT NULL THEN
    SET NEW.tenant_id = @logto_tenant_id;
  END IF;
END;
`;
  }

  if (fileName === '_before_all.sql') {
    return `/* MariaDB path: single application user — no per-tenant CREATE ROLE. */
`;
  }

  if (fileName === '_after_all.sql') {
    return `/* MariaDB path: grants managed at deployment — no Postgres role grants. */
`;
  }

  let result = content;

  // Remove enum create statements (converted to varchar on columns)
  result = result.replace(/create type \w+ as enum \([^)]+\);?\s*/gi, '');

  // Type conversions
  result = convertEnumColumns(result);
  result = result.replace(/\bjsonb\b/gi, 'JSON');
  result = result.replace(/\btimestamptz\b/gi, 'DATETIME(3)');
  result = result.replace(/::jsonb/gi, '');
  result = result.replace(/'{}'::json/gi, "'{}'");
  result = result.replace(/'\[\]'::json/gi, "'[]'");
  result = result.replace(/default \(now\(\)\)/gi, 'DEFAULT CURRENT_TIMESTAMP(3)');
  result = result.replace(/default\(now\(\)\)/gi, 'DEFAULT CURRENT_TIMESTAMP(3)');
  result = result.replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP(3)');

  // Postgres-specific index syntax
  result = result.replace(/\s+using gin\s*\([^)]+\)/gi, '');
  result = result.replace(/\s+where\s+username is not null/gi, '');

  // Trigger syntax
  result = result.replace(/execute procedure set_updated_at\(\)/gi, 'SET NEW.updated_at = CURRENT_TIMESTAMP(3)');
  result = result.replace(
    /create trigger set_updated_at\s+before update on (\w+)\s+for each row\s+SET NEW\.updated_at = CURRENT_TIMESTAMP\(3\)/gi,
    'CREATE TRIGGER set_updated_at BEFORE UPDATE ON $1 FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP(3)'
  );

  // Remove Postgres-only table options
  result = result.replace(
    /alter table [\w.]+\s+set\s*\([\s\S]*?autovacuum_[\s\S]*?\);\s*/gi,
    ''
  );

  // Postgres expression indexes on JSON paths → MariaDB virtual columns + btree indexes
  if (fileName === 'oidc_model_instances.sql') {
    result = result.replace(
      /create index oidc_model_instances__model_name_payload_user_code[\s\S]*?alter table oidc_model_instances set[\s\S]*?\);\s*/m,
      ''
    );
    result = result.replace(
      /(consumed_at DATETIME\(3\),)/i,
      `$1
  payload_user_code varchar(128) as (json_unquote(json_extract(payload, '$.userCode'))) virtual,
  payload_uid varchar(128) as (json_unquote(json_extract(payload, '$.uid'))) virtual,
  payload_grant_id varchar(128) as (json_unquote(json_extract(payload, '$.grantId'))) virtual,
  payload_account_id varchar(128) as (json_unquote(json_extract(payload, '$.accountId'))) virtual,`
    );
    result += `
create index oidc_model_instances__model_name_payload_user_code
  on oidc_model_instances (tenant_id, model_name, payload_user_code);

create index oidc_model_instances__model_name_payload_uid
  on oidc_model_instances (tenant_id, model_name, payload_uid);

create index oidc_model_instances__model_name_payload_grant_id_partial
  on oidc_model_instances (tenant_id, model_name, payload_grant_id)
  where payload_grant_id is not null;

create index oidc_model_instances__expires_at
  on oidc_model_instances (tenant_id, expires_at);

create index oidc_model_instances__session_payload_account_id_expires_at
  on oidc_model_instances (tenant_id, payload_account_id, expires_at)
  where model_name = 'Session';

create index oidc_model_instances__grant_payload_account_id_expires_at
  on oidc_model_instances (tenant_id, payload_account_id, expires_at)
  where model_name = 'Grant';
`;
  }

  if (fileName === 'logs.sql') {
    result = result.replace(
      /create index logs__user_id[\s\S]*?create index logs__created_at_id[\s\S]*?\);\s*/m,
      ''
    );
    result = result.replace(
      /(created_at DATETIME\(3\) not null DEFAULT CURRENT_TIMESTAMP\(3\),)/i,
      `$1
  payload_user_id varchar(128) as (json_unquote(json_extract(payload, '$.userId'))) virtual,
  payload_application_id varchar(21) as (json_unquote(json_extract(payload, '$.applicationId'))) virtual,
  payload_hook_id varchar(21) as (json_unquote(json_extract(payload, '$.hookId'))) virtual,`
    );
    result += `
create index logs__user_id
  on logs (tenant_id, payload_user_id);

create index logs__application_id
  on logs (tenant_id, payload_application_id);

create index logs__hook_id
  on logs (tenant_id, payload_hook_id);

create index logs__created_at_id
  on logs (tenant_id, created_at, id);
`;
  }

  if (fileName === 'applications.sql') {
    result = result.replace(
      /create unique index applications__protected_app_metadata_host[\s\S]*?create unique index applications__protected_app_metadata_custom_domain[\s\S]*?\);/m,
      ''
    );
    result = result.replace(
      /(created_at DATETIME\(3\) not null DEFAULT CURRENT_TIMESTAMP\(3\),)/i,
      `$1
  protected_app_metadata_host char(255) as (json_unquote(json_extract(protected_app_metadata, '$.host'))) virtual,
  protected_app_metadata_custom_domain char(255) as (json_unquote(json_extract(protected_app_metadata, '$.customDomains[0].domain'))) virtual,`
    );
    result += `
create unique index applications__protected_app_metadata_host
  on applications (protected_app_metadata_host);

create unique index applications__protected_app_metadata_custom_domain
  on applications (protected_app_metadata_custom_domain);
`;
  }

  // Postgres json path indexes (fallback for other tables)
  result = result.replace(
    /create unique index (\w+)\s+on (\w+) \(\s*\(([^)]+)\)\s*\);/gi,
    'create unique index $1 on $2 (($3));'
  );

  // References — MariaDB supports same FK syntax
  return result;
};

const main = async () => {
  await fs.mkdir(targetDir, { recursive: true });
  const files = await fs.readdir(sourceDir);
  const sqlFiles = files.filter((file) => file.endsWith('.sql'));

  for (const file of sqlFiles) {
    const content = await fs.readFile(path.join(sourceDir, file), 'utf8');
    extractEnums(content);
  }

  for (const file of sqlFiles) {
    const content = await fs.readFile(path.join(sourceDir, file), 'utf8');
    const converted = convertContent(file, content);
    await fs.writeFile(path.join(targetDir, file), converted);
  }

  // MariaDB-specific lifecycle aliases
  await fs.writeFile(
    path.join(targetDir, '_functions_mariadb.sql'),
    await fs.readFile(path.join(targetDir, '_functions.sql'), 'utf8')
  );
  await fs.writeFile(
    path.join(targetDir, '_after_each_mariadb.sql'),
    await fs.readFile(path.join(targetDir, '_after_each.sql'), 'utf8')
  );

  console.log(`Converted ${sqlFiles.length} SQL files to ${targetDir}`);
};

await main();
