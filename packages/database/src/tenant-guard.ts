/** Tables that include tenant_id and require isolation on the MariaDB path. */
export const tenantScopedTableNames = new Set([
  'users',
  'applications',
  'roles',
  'scopes',
  'resources',
  'connectors',
  'hooks',
  'logs',
  'sign_in_experiences',
  'domains',
  'organizations',
  'organization_roles',
  'organization_scopes',
  'oidc_model_instances',
  'verification_statuses',
  'verification_records',
  'passcodes',
  'custom_phrases',
  'logto_configs',
  'systems',
  'email_templates',
  'account_centers',
  'captcha_providers',
  'custom_profile_fields',
  'application_sign_in_experiences',
  'application_secrets',
  'secrets',
  'sso_connectors',
  'user_sso_identities',
  'subject_tokens',
  'one_time_tokens',
  'sentinel_activities',
  'saml_application_configs',
  'saml_application_sessions',
  'saml_application_secrets',
  'idp_initiated_saml_sso_sessions',
  'oidc_session_extensions',
  'service_logs',
]);

export type TenantContext = {
  tenantId: string;
  isAdmin: boolean;
};

const tenantIdPattern = /\btenant_id\b\s*=\s*['"]?([a-zA-Z0-9_-]+)/i;

export type TenantGuardViolation = {
  table: string;
  reason: string;
};

export const assertTenantScopedSql = (
  sqlText: string,
  context: TenantContext,
  tableNames: ReadonlySet<string> = tenantScopedTableNames
): TenantGuardViolation | undefined => {
  if (context.isAdmin) {
    return;
  }

  const normalized = sqlText.toLowerCase();

  for (const table of tableNames) {
    if (!normalized.includes(table)) {
      continue;
    }

    const match = tenantIdPattern.exec(sqlText);

    if (!match || match[1] !== context.tenantId) {
      return {
        table,
        reason: `Query on tenant-scoped table "${table}" must filter tenant_id = '${context.tenantId}'`,
      };
    }
  }

  return;
};

export class TenantGuardError extends Error {
  readonly violation: TenantGuardViolation;

  constructor(violation: TenantGuardViolation) {
    super(violation.reason);
    this.name = 'TenantGuardError';
    this.violation = violation;
  }
}

export const enforceTenantGuard = (
  sqlText: string,
  context: TenantContext,
  tableNames?: ReadonlySet<string>
) => {
  const violation = assertTenantScopedSql(sqlText, context, tableNames);

  if (violation) {
    throw new TenantGuardError(violation);
  }
};

export const buildTenantSessionStatements = (context: TenantContext): string[] => [
  `SET @logto_tenant_id = '${context.tenantId.replaceAll("'", "''")}'`,
];

const extractSqlText = (query: unknown): string => {
  if (typeof query === 'string') {
    return query;
  }

  if (
    typeof query === 'object' &&
    query !== null &&
    'type' in query &&
    (query as { type: string }).type === 'SLONIK_TOKEN_SQL' &&
    'sql' in query
  ) {
    return String((query as { sql: string }).sql);
  }

  return '';
};

type GuardedPool = {
  query: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  one?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  maybeOne?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  transaction?: (handler: (connection: GuardedPool) => Promise<unknown>) => Promise<unknown>;
};

export const wrapPoolWithTenantGuard = <T extends GuardedPool>(
  pool: T,
  context: TenantContext,
  tableNames?: ReadonlySet<string>
): T => {
  const applySession = async () => {
    for (const statement of buildTenantSessionStatements(context)) {
      await pool.query(statement);
    }
  };

  const guardQuery = async (query: unknown, values?: readonly unknown[]) => {
    const sqlText = extractSqlText(query);

    if (sqlText) {
      enforceTenantGuard(sqlText, context, tableNames);
    }

    await applySession();

    return pool.query(query, values);
  };

  const wrapped: GuardedPool = {
    ...pool,
    query: guardQuery,
    one: pool.one
      ? async (query, values) => {
          const sqlText = extractSqlText(query);

          if (sqlText) {
            enforceTenantGuard(sqlText, context, tableNames);
          }

          await applySession();

          return pool.one!(query, values);
        }
      : undefined,
    maybeOne: pool.maybeOne
      ? async (query, values) => {
          const sqlText = extractSqlText(query);

          if (sqlText) {
            enforceTenantGuard(sqlText, context, tableNames);
          }

          await applySession();

          return pool.maybeOne!(query, values);
        }
      : undefined,
    transaction: pool.transaction
      ? async (handler) =>
          pool.transaction!(async (connection) =>
            handler(wrapPoolWithTenantGuard(connection as T, context, tableNames))
          )
      : undefined,
  };

  return wrapped as T;
};
