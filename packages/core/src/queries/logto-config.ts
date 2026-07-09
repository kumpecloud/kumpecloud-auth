import {
  type jwtCustomizerConfigGuard,
  LogtoConfigs,
  LogtoTenantConfigKey,
  type AdminConsoleData,
  type IdTokenConfig,
  type LogtoConfig,
  type LogtoConfigKey,
  LogtoOidcConfigKey,
  type LogtoJwtTokenKey,
  type OidcPrivateKey,
  oidcPrivateKeyGuard,
  idTokenConfigGuard,
  type LogtoOidcConfigType,
  signingKeyRotationStateGuard,
  type SigningKeyRotationState,
  amemberSyncStoredConfigGuard,
  type AMemberSyncStoredConfig,
} from '@logto/schemas';
import { asSqlFragment, buildJsonCoalesceMerge, DatabaseDialect, getQueryDialectFromUrl } from '@logto/database';
import type { CommonQueryMethods } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';
import { type z } from 'zod';

import { type WellKnownCache } from '#src/caches/well-known.js';
import { DeletionError } from '#src/errors/SlonikError/index.js';
import { convertToIdentifiers } from '#src/utils/sql.js';

const { table, fields } = convertToIdentifiers(LogtoConfigs);
const qualifiedValueField = sql.identifier([LogtoConfigs.table, LogtoConfigs.fields.value]);

export const createLogtoConfigQueries = (
  pool: CommonQueryMethods,
  wellKnownCache: WellKnownCache
) => {
  const queryDialect = getQueryDialectFromUrl(process.env.DB_URL ?? '');
  const logtoConfigUpsertConflict = asSqlFragment(
    queryDialect.buildOnConflictClause({
      fields: [fields.tenantId, fields.key],
      setExcludedFields: [fields.value],
    })
  );
  const upsertPrivateSigningKeysWithExecutor = async (
    executor: CommonQueryMethods,
    privateKeys: OidcPrivateKey[]
  ) =>
    executor.one<{ key: LogtoOidcConfigKey.PrivateKeys; value: unknown }>(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (${LogtoOidcConfigKey.PrivateKeys}, ${sql.jsonb(privateKeys)})
        ${logtoConfigUpsertConflict}
        returning ${fields.key}, ${fields.value}
    `);

  const upsertPrivateSigningKeys = async (privateKeys: OidcPrivateKey[]) =>
    upsertPrivateSigningKeysWithExecutor(pool, privateKeys);

  const getAdminConsoleConfig = async () =>
    pool.one<{ value: unknown }>(sql`
      select ${fields.value} from ${table}
      where ${fields.key} = ${LogtoTenantConfigKey.AdminConsole}
    `);

  const updateAdminConsoleConfig = async (value: Partial<AdminConsoleData>) =>
    pool.one<{ value: unknown }>(sql`
      update ${table}
      set ${fields.value} = ${buildJsonCoalesceMerge(fields.value, sql.jsonb(value), queryDialect.dialect)}
      where ${fields.key} = ${LogtoTenantConfigKey.AdminConsole}
      returning ${fields.value}
    `);

  const getCloudConnectionData = async () =>
    pool.one<{ value: unknown }>(sql`
      select ${fields.value} from ${table}
      where ${fields.key} = ${LogtoTenantConfigKey.CloudConnection}
    `);

  const getRowsByKeys = async (keys: LogtoConfigKey[]) =>
    pool.query<LogtoConfig>(sql`
      select ${sql.join([fields.key, fields.value], sql`,`)} from ${table}
        where ${fields.key} in (${sql.join(keys, sql`,`)})
    `);

  const deleteRowByKey = async (key: LogtoConfigKey) => {
    const { rowCount } = await pool.query(sql`
      delete from ${table}
      where ${fields.key}=${key}
    `);

    if (rowCount < 1) {
      throw new DeletionError(LogtoConfigs.table, key);
    }
  };

  const lockPrivateSigningKeys = async () =>
    pool.query(sql`
      select ${fields.key}
      from ${table}
      where ${fields.key} = ${LogtoOidcConfigKey.PrivateKeys}
      for update
    `);

  const lockPrivateSigningKeysAndRotationState = async () =>
    pool.query(sql`
      select ${fields.key}
      from ${table}
      where ${fields.key} in (
        ${LogtoOidcConfigKey.PrivateKeys},
        ${LogtoTenantConfigKey.SigningKeyRotationState}
      )
      for update
    `);

  const getSigningKeyRotationStateWithExecutor = async (
    executor: CommonQueryMethods
  ): Promise<SigningKeyRotationState | undefined> => {
    const { rows } = await executor.query<LogtoConfig>(sql`
      select ${sql.join([fields.key, fields.value], sql`,`)} from ${table}
        where ${fields.key} = ${LogtoTenantConfigKey.SigningKeyRotationState}
    `);

    if (rows.length === 0) {
      return undefined;
    }

    return signingKeyRotationStateGuard.parse(rows[0]?.value);
  };
  const upsertSigningKeyRotationStateWithExecutor = async (
    executor: CommonQueryMethods,
    value: SigningKeyRotationState
  ) =>
    executor.one<{ value: SigningKeyRotationState }>(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (${LogtoTenantConfigKey.SigningKeyRotationState}, ${sql.jsonb(value)})
        ${logtoConfigUpsertConflict}
        returning ${fields.value}
    `);

  const getPrivateSigningKeys = async (): Promise<OidcPrivateKey[]> => {
    const { rows } = await pool.query<LogtoConfig>(sql`
      select ${sql.join([fields.key, fields.value], sql`,`)} from ${table}
      where ${fields.key} = ${LogtoOidcConfigKey.PrivateKeys}
    `);

    return oidcPrivateKeyGuard.array().parse(rows[0]?.value);
  };

  const updateOidcConfigsByKey = async <
    T extends Exclude<LogtoOidcConfigKey, LogtoOidcConfigKey.PrivateKeys>,
  >(
    key: T,
    value: LogtoOidcConfigType[T]
  ) =>
    pool.query(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (${key}, ${sql.jsonb(value)})
        ${logtoConfigUpsertConflict}
        returning *
    `);

  const getSigningKeyRotationState = async (): Promise<SigningKeyRotationState | undefined> =>
    getSigningKeyRotationStateWithExecutor(pool);

  const upsertSigningKeyRotationState = async (
    value: SigningKeyRotationState
  ): Promise<SigningKeyRotationState> => {
    const { value: rawValue } = await upsertSigningKeyRotationStateWithExecutor(pool, value);

    return signingKeyRotationStateGuard.parse(rawValue);
  };

  const setTenantCacheExpiresAt = async (
    tenantCacheExpiresAt: number
  ): Promise<SigningKeyRotationState> => {
    const mergeValue = buildJsonCoalesceMerge(
      qualifiedValueField,
      sql.jsonb({ tenantCacheExpiresAt }),
      queryDialect.dialect
    );
    const { value: rawValue } = await pool.one<{ value: SigningKeyRotationState }>(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (
          ${LogtoTenantConfigKey.SigningKeyRotationState},
          ${sql.jsonb({ tenantCacheExpiresAt })}
        )
        ${
          queryDialect.dialect === DatabaseDialect.MariaDB
            ? sql`ON DUPLICATE KEY UPDATE ${fields.value} = ${mergeValue}`
            : sql`on conflict (${fields.tenantId}, ${fields.key}) do update set ${fields.value} = ${mergeValue}`
        }
        returning ${fields.value}
    `);

    return signingKeyRotationStateGuard.parse(rawValue);
  };

  const setSigningKeyRotationAt = async (
    signingKeyRotationAt: number
  ): Promise<SigningKeyRotationState> => {
    const mergeValue = buildJsonCoalesceMerge(
      qualifiedValueField,
      sql.jsonb({ signingKeyRotationAt }),
      queryDialect.dialect
    );
    const { value: rawValue } = await pool.one<{ value: SigningKeyRotationState }>(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (
          ${LogtoTenantConfigKey.SigningKeyRotationState},
          ${sql.jsonb({ signingKeyRotationAt })}
        )
        ${
          queryDialect.dialect === DatabaseDialect.MariaDB
            ? sql`ON DUPLICATE KEY UPDATE ${fields.value} = ${mergeValue}`
            : sql`on conflict (${fields.tenantId}, ${fields.key}) do update set ${fields.value} = ${mergeValue}`
        }
        returning ${fields.value}
    `);

    return signingKeyRotationStateGuard.parse(rawValue);
  };

  // Can not narrow down the type of value if we utilize `buildInsertIntoWithPool` method.
  const upsertJwtCustomizer = async <T extends LogtoJwtTokenKey>(
    key: T,
    value: z.infer<(typeof jwtCustomizerConfigGuard)[T]>
  ) =>
    pool.one<{ key: T; value: Record<string, string> }>(
      sql`
        insert into ${table} (${fields.key}, ${fields.value})
          values (${key}, ${sql.jsonb(value)})
          ${logtoConfigUpsertConflict}
          returning *
      `
    );

  const deleteJwtCustomizer = async <T extends LogtoJwtTokenKey>(key: T) => deleteRowByKey(key);

  const getIdTokenConfig = wellKnownCache.memoize(async () => {
    const { rows } = await getRowsByKeys([LogtoTenantConfigKey.IdToken]);

    if (rows.length === 0) {
      return null;
    }

    return idTokenConfigGuard.parse(rows[0]?.value);
  }, ['id-token-config']);

  const upsertIdTokenConfig = wellKnownCache.mutate(
    async (value: IdTokenConfig) =>
      pool.one<{ value: unknown }>(sql`
        insert into ${table} (${fields.key}, ${fields.value})
          values (${LogtoTenantConfigKey.IdToken}, ${sql.jsonb(value)})
          on conflict (${fields.tenantId}, ${fields.key}) do update set ${fields.value} = ${sql.jsonb(value)}
          returning ${fields.value}
      `),
    ['id-token-config']
  );

  const getAMemberSyncConfig = async (): Promise<AMemberSyncStoredConfig | undefined> => {
    const { rows } = await getRowsByKeys([LogtoTenantConfigKey.AMemberSync]);

    if (rows.length === 0) {
      return;
    }

    return amemberSyncStoredConfigGuard.parse(rows[0]?.value);
  };

  const upsertAMemberSyncConfig = async (
    patch: Partial<AMemberSyncStoredConfig>
  ): Promise<AMemberSyncStoredConfig> => {
    const existing = (await getAMemberSyncConfig()) ?? amemberSyncStoredConfigGuard.parse({});
    const merged = amemberSyncStoredConfigGuard.parse({ ...existing, ...patch });

    const { value } = await pool.one<{ value: unknown }>(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (${LogtoTenantConfigKey.AMemberSync}, ${sql.jsonb(merged)})
        on conflict (${fields.tenantId}, ${fields.key}) do update set ${fields.value} = ${sql.jsonb(merged)}
        returning ${fields.value}
    `);

    return amemberSyncStoredConfigGuard.parse(value);
  };

  return {
    getAdminConsoleConfig,
    updateAdminConsoleConfig,
    getCloudConnectionData,
    getRowsByKeys,
    lockPrivateSigningKeys,
    lockPrivateSigningKeysAndRotationState,
    getPrivateSigningKeys,
    upsertPrivateSigningKeys,
    updateOidcConfigsByKey,
    getSigningKeyRotationState,
    upsertSigningKeyRotationState,
    setTenantCacheExpiresAt,
    setSigningKeyRotationAt,
    upsertJwtCustomizer,
    deleteJwtCustomizer,
    getIdTokenConfig,
    upsertIdTokenConfig,
    getAMemberSyncConfig,
    upsertAMemberSyncConfig,
  };
};
