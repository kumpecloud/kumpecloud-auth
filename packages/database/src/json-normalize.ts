/** Normalize MariaDB JSON_ARRAYAGG / JSON column values to string[]. */
export const normalizeJsonStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);

      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map(String);
  }

  return [];
};

/**
 * MariaDB/mysql2 often returns JSON columns as strings. Coerce object/array JSON
 * strings so Zod guards and app code see parsed values like Postgres jsonb.
 */
export const normalizeJsonValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};
