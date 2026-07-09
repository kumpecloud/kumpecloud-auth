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
