/** Tables that include tenant_id and require isolation on the MariaDB path. */
export const tenantScopedTableNames = new Set([
  'account_centers',
  'aggregated_daily_active_users',
  'application_access_control_org_role_relations',
  'application_access_control_organization_relations',
  'application_access_control_user_relations',
  'application_access_control_user_role_relations',
  'application_secrets',
  'application_sign_in_experiences',
  'application_user_consent_organization_resource_scopes',
  'application_user_consent_organization_scopes',
  'application_user_consent_organizations',
  'application_user_consent_resource_scopes',
  'application_user_consent_user_scopes',
  'applications',
  'applications_roles',
  'captcha_providers',
  'connectors',
  'custom_phrases',
  'custom_profile_fields',
  'daily_active_users',
  'daily_token_usage',
  'domains',
  'email_templates',
  'hooks',
  'idp_initiated_saml_sso_sessions',
  'logs',
  'logto_configs',
  'oidc_model_instances',
  'oidc_session_extensions',
  'one_time_tokens',
  'organization_application_relations',
  'organization_invitation_role_relations',
  'organization_invitations',
  'organization_jit_email_domains',
  'organization_jit_roles',
  'organization_jit_sso_connectors',
  'organization_role_application_relations',
  'organization_role_resource_scope_relations',
  'organization_role_scope_relations',
  'organization_role_user_relations',
  'organization_roles',
  'organization_scopes',
  'organization_user_relations',
  'organizations',
  'passcodes',
  'personal_access_tokens',
  'resources',
  'roles',
  'roles_scopes',
  'saml_application_configs',
  'saml_application_secrets',
  'saml_application_sessions',
  'scopes',
  'secret_enterprise_sso_connector_relations',
  'secret_social_connector_relations',
  'secrets',
  'sentinel_activities',
  'service_logs',
  'sign_in_experiences',
  'sso_connector_idp_initiated_auth_configs',
  'sso_connectors',
  'subject_tokens',
  'user_geo_locations',
  'user_sign_in_countries',
  'user_sso_identities',
  'users',
  'users_roles',
  'verification_records',
  'verification_statuses',
]);

export type TenantContext = {
  tenantId: string;
  isAdmin: boolean;
};

const tenantIdPattern = /\btenant_id\b/i;
const tenantIdLiteralPattern = (tenantId: string) =>
  new RegExp(
    `\\btenant_id\\s*=\\s*['"\`]?${tenantId.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&')}['"\`]?`,
    'i'
  );
const tenantIdParameterPattern = /\btenant_id\s*=\s*(\?|\$\d+|@logto_tenant_id)/i;
const anyTenantIdLiteralPattern = /\btenant_id\s*=\s*['"`]([^'"`]+)['"`]/gi;

/** Predicate injected to replace Postgres RLS for SELECT/UPDATE/DELETE. */
export const tenantSessionPredicate = 'tenant_id = @logto_tenant_id';

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

const isSessionOrTxnControl = (sqlText: string) =>
  /^\s*(set|start|begin|commit|rollback|savepoint|release)\b/i.test(sqlText);

/** INSERT relies on `@logto_tenant_id` + BEFORE INSERT trigger to fill tenant_id. */
const isInsertStatement = (sqlText: string) => /^\s*insert\b/i.test(sqlText);

const findCrossTenantLiteral = (sqlText: string, tenantId: string): string | undefined => {
  for (const match of sqlText.matchAll(anyTenantIdLiteralPattern)) {
    const literal = match[1];

    if (literal && literal !== tenantId) {
      return literal;
    }
  }

  return;
};

const trailingClausePattern =
  /\s+(?:order\s+by|group\s+by|having|limit|offset|for\s+update|for\s+share|returning)\b/i;

/**
 * Inject `tenant_id = @logto_tenant_id` into SELECT/UPDATE/DELETE that touch tenant-scoped
 * tables and lack an isolation predicate. Mirrors Postgres RLS for the shared MariaDB user.
 */
export const injectTenantIsolationPredicate = (
  sqlText: string,
  context: TenantContext,
  tableNames: ReadonlySet<string> = tenantScopedTableNames
): string => {
  // Admin tenant is still a tenant: Postgres RLS scopes it to its own tenant_id.
  // Cross-tenant reads use the unwrapped shared pool with explicit tenant_id filters.
  if (isSessionOrTxnControl(sqlText) || isInsertStatement(sqlText)) {
    return sqlText;
  }

  // Slonik sometimes includes a trailing `;`; never inject past statement end.
  const statementEndMatch = /;+\s*$/.exec(sqlText);
  const statementBody = statementEndMatch
    ? sqlText.slice(0, statementEndMatch.index)
    : sqlText;
  const statementSuffix = statementEndMatch ? sqlText.slice(statementEndMatch.index) : '';

  const referencedTables = findReferencedTenantTables(statementBody, tableNames);

  if (
    referencedTables.length === 0 ||
    hasTenantIsolationPredicate(statementBody, context.tenantId)
  ) {
    return sqlText;
  }

  const predicate =
    referencedTables.length === 1
      ? tenantSessionPredicate
      : referencedTables.map((table) => `${table}.tenant_id = @logto_tenant_id`).join(' AND ');

  const trailingMatch = trailingClausePattern.exec(statementBody);
  const trailingIndex = trailingMatch?.index;

  if (/\bwhere\b/i.test(statementBody)) {
    if (trailingIndex === undefined) {
      return `${statementBody} AND ${predicate}${statementSuffix}`;
    }

    return `${statementBody.slice(0, trailingIndex)} AND ${predicate}${statementBody.slice(trailingIndex)}${statementSuffix}`;
  }

  if (trailingIndex === undefined) {
    return `${statementBody} WHERE ${predicate}${statementSuffix}`;
  }

  return `${statementBody.slice(0, trailingIndex)} WHERE ${predicate}${statementBody.slice(trailingIndex)}${statementSuffix}`;
};

export const assertTenantScopedSql = (
  sqlText: string,
  context: TenantContext,
  tableNames: ReadonlySet<string> = tenantScopedTableNames
): TenantGuardViolation | undefined => {
  if (isSessionOrTxnControl(sqlText) || isInsertStatement(sqlText)) {
    return;
  }

  const referencedTables = findReferencedTenantTables(sqlText, tableNames);

  if (referencedTables.length === 0) {
    return;
  }

  const crossTenant = findCrossTenantLiteral(sqlText, context.tenantId);

  if (crossTenant) {
    return {
      table: referencedTables[0]!,
      reason: `Query on tenant-scoped table "${referencedTables[0]!}" must not filter tenant_id to '${crossTenant}' for tenant '${context.tenantId}'.`,
    };
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

const withRewrittenSql = (query: unknown, rewrittenSql: string): unknown => {
  if (typeof query === 'string') {
    return rewrittenSql;
  }

  if (
    typeof query === 'object' &&
    query !== null &&
    'type' in query &&
    (query as { type: string }).type === 'SLONIK_TOKEN_SQL'
  ) {
    return { ...(query as Record<string, unknown>), sql: rewrittenSql };
  }

  return query;
};

type GuardedPool = {
  query: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  one?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  maybeOne?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  any?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  exists?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  oneFirst?: (query: unknown, values?: readonly unknown[]) => Promise<unknown>;
  transaction?: (handler: (connection: GuardedPool) => Promise<unknown>) => Promise<unknown>;
};

export const wrapPoolWithTenantGuard = <T extends GuardedPool>(
  pool: T,
  context: TenantContext,
  tableNames?: ReadonlySet<string>
): T => {
  const scopedTables = tableNames ?? tenantScopedTableNames;

  const applySession = async () => {
    for (const statement of buildTenantSessionStatements(context)) {
      await pool.query(statement);
    }
  };

  const prepareQuery = (query: unknown) => {
    const sqlText = extractSqlText(query);

    if (!sqlText) {
      return query;
    }

    const rewrittenSql = injectTenantIsolationPredicate(sqlText, context, scopedTables);
    enforceTenantGuard(rewrittenSql, context, scopedTables);

    return withRewrittenSql(query, rewrittenSql);
  };

  const guardCall =
    (method: keyof GuardedPool) =>
    async (query: unknown, values?: readonly unknown[]) => {
      const prepared = prepareQuery(query);
      await applySession();

      // eslint-disable-next-line no-restricted-syntax -- dynamic pool method dispatch
      return (pool[method] as (query: unknown, values?: readonly unknown[]) => Promise<unknown>)(
        prepared,
        values
      );
    };

  const wrapped: GuardedPool = {
    ...pool,
    query: guardCall('query'),
    one: pool.one ? guardCall('one') : undefined,
    maybeOne: pool.maybeOne ? guardCall('maybeOne') : undefined,
    any: pool.any ? guardCall('any') : undefined,
    exists: pool.exists ? guardCall('exists') : undefined,
    oneFirst: pool.oneFirst ? guardCall('oneFirst') : undefined,
    transaction: pool.transaction
      ? async (handler) =>
          pool.transaction!(async (connection) =>
            handler(wrapPoolWithTenantGuard(connection as T, context, scopedTables))
          )
      : undefined,
  };

  return wrapped as T;
};
