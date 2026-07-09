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

const tenantIdPattern = /\btenant_id\b/i;
const tenantIdLiteralPattern = (tenantId: string) =>
  new RegExp(`\\btenant_id\\s*=\\s*['"]?${tenantId.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&')}['"]?`, 'i');
const tenantIdParameterPattern = /\btenant_id\s*=\s*(\?|\$\d+)/i;

export type TenantGuardViolation = {
  table: string;
  reason: string;
};

const findReferencedTenantTables = (
  sqlText: string,
  tableNames: ReadonlySet<string>
): string[] => {
  const normalized = sqlText.toLowerCase();
  const referenced: string[] = [];

  for (const table of tableNames) {
    const tablePattern = new RegExp(`\\b${table}\\b`, 'i');

    if (tablePattern.test(normalized)) {
      referenced.push(table);
    }
  }

  return referenced;
};

const hasTenantIsolationPredicate = (sqlText: string, tenantId: string) => {
  if (!tenantIdPattern.test(sqlText)) {
    return false;
  }

  if (tenantIdLiteralPattern(tenantId).test(sqlText)) {
    return true;
  }

  if (tenantIdParameterPattern.test(sqlText)) {
    return true;
  }

  if (/\b@logto_tenant_id\b/i.test(sqlText)) {
    return true;
  }

  return false;
};

export const assertTenantScopedSql = (
  sqlText: string,
  context: TenantContext,
  tableNames: ReadonlySet<string> = tenantScopedTableNames
): TenantGuardViolation | undefined => {
  if (context.isAdmin) {
    return;
  }

  const referencedTables = findReferencedTenantTables(sqlText, tableNames);

  if (referencedTables.length === 0) {
    return;
  }

  if (!hasTenantIsolationPredicate(sqlText, context.tenantId)) {
    const joinHint =
      referencedTables.length > 1
        ? ' Multi-table queries must include a tenant_id filter.'
        : '';

    return {
      table: referencedTables[0]!,
      reason: `Query on tenant-scoped table "${referencedTables[0]!}" must filter tenant_id for tenant '${context.tenantId}'.${joinHint}`,
    };
  }

  if (
    !tenantIdLiteralPattern(context.tenantId).test(sqlText) &&
    !tenantIdParameterPattern.test(sqlText) &&
    !/\b@logto_tenant_id\b/i.test(sqlText)
  ) {
    return {
      table: referencedTables[0]!,
      reason: `Query on tenant-scoped table "${referencedTables[0]!}" must bind tenant_id to '${context.tenantId}'`,
    };
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
