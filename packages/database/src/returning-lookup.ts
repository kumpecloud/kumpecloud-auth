const autoSetLookupKeys = new Set(['tenantId', 'createdAt', 'updatedAt']);

/**
 * Resolve which inserted columns uniquely identify a row for MariaDB RETURNING fallback.
 * Prefers single-column `id` when present; otherwise uses all non-auto-set inserted keys.
 */
export const getMariaReturningLookupKeys = <Key extends string>(
  insertingKeys: readonly Key[],
  data: Partial<Record<Key, unknown>>
): Key[] => {
  const presentKeys = insertingKeys.filter((key) => data[key] !== undefined);

  if (presentKeys.includes('id' as Key)) {
    return ['id' as Key];
  }

  const lookupKeys = presentKeys.filter((key) => !autoSetLookupKeys.has(key));

  return lookupKeys.length > 0 ? lookupKeys : presentKeys;
};
