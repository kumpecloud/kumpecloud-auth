import { HTTPError } from 'got';

const entityIdKeys = ['user_id', 'userId', 'id'] as const;

const getAMemberApiErrorMessage = (body: Record<string, unknown>): string => {
  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  if (typeof body.msg === 'string' && body.msg.length > 0) {
    return body.msg;
  }

  if (body.code !== undefined) {
    return `error code ${String(body.code)}`;
  }

  return 'unknown error';
};

const describeBody = (body: unknown): string => {
  if (body === undefined || body === null) {
    return String(body);
  }

  if (typeof body === 'string') {
    return body.slice(0, 500);
  }

  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const unwrapEntityRecord = (body: Record<string, unknown>): Record<string, unknown> => {
  if (entityIdKeys.some((key) => body[key] !== undefined)) {
    return body;
  }

  for (const key of ['user', '_item', 'record', 'data']) {
    const nested = body[key];

    if (isRecord(nested) && entityIdKeys.some((idKey) => nested[idKey] !== undefined)) {
      return nested;
    }
  }

  if (Array.isArray(body._items) && body._items.length === 1) {
    const [item] = body._items;

    if (isRecord(item)) {
      return item;
    }
  }

  return body;
};

/**
 * aMember REST responses vary by endpoint/version: JSON objects, numeric ids, stringified JSON,
 * or single-item arrays. Normalize before success/id validation.
 */
export const normalizeAMemberApiResponseBody = (body: unknown): unknown => {
  if (body === undefined || body === null) {
    return body;
  }

  if (typeof body === 'string') {
    const trimmed = body.trim();

    if (trimmed.length === 0) {
      return body;
    }

    if (/^\d+$/u.test(trimmed)) {
      return { user_id: Number(trimmed) };
    }

    try {
      return normalizeAMemberApiResponseBody(JSON.parse(trimmed));
    } catch {
      return body;
    }
  }

  if (typeof body === 'number' && Number.isFinite(body)) {
    return { user_id: body };
  }

  if (isRecord(body) && Array.isArray(body._items) && body._items.length === 1) {
    return normalizeAMemberApiResponseBody(body._items[0]);
  }

  if (Array.isArray(body)) {
    if (body.length === 1) {
      return normalizeAMemberApiResponseBody(body[0]);
    }
  }

  return body;
};

export const assertAMemberApiSuccess = (body: unknown, action: string): void => {
  const normalized = normalizeAMemberApiResponseBody(body);

  if (normalized === undefined || normalized === null) {
    throw new Error(`aMember API returned no response body for ${action}`);
  }

  if (!isRecord(normalized)) {
    throw new Error(
      `aMember API returned an unexpected response for ${action}: ${describeBody(normalized)}`
    );
  }

  const response = normalized;

  if (response.ok === false) {
    throw new Error(`aMember API ${action} failed: ${getAMemberApiErrorMessage(response)}`);
  }

  if (response.error === true) {
    throw new Error(`aMember API ${action} failed: ${getAMemberApiErrorMessage(response)}`);
  }
};

export const parseAMemberEntityId = (
  body: unknown,
  idKeys: string[],
  entityName: string,
  action: string
): number => {
  const normalized = normalizeAMemberApiResponseBody(body);
  assertAMemberApiSuccess(normalized, action);

  if (!isRecord(normalized)) {
    throw new Error(`aMember API ${action} did not return a ${entityName} id`);
  }

  const record = unwrapEntityRecord(normalized);

  for (const key of idKeys) {
    const parsed = Number(record[key]);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`aMember API ${action} did not return a ${entityName} id`);
};

export const executeAMemberJsonRequest = async <T>(
  action: string,
  request: () => Promise<T>
): Promise<T> => {
  try {
    return await request();
  } catch (error: unknown) {
    if (error instanceof HTTPError) {
      const body = normalizeAMemberApiResponseBody(error.response.body);

      if (isRecord(body)) {
        assertAMemberApiSuccess(body, action);
      }

      throw new Error(
        `aMember API ${action} failed with HTTP ${error.response.statusCode}: ${error.message}`,
        { cause: error }
      );
    }

    throw error;
  }
};

export const readAMemberJsonResponse = async (
  action: string,
  request: () => Promise<unknown>
): Promise<unknown> =>
  executeAMemberJsonRequest(action, async () => {
    const body = normalizeAMemberApiResponseBody(await request());
    assertAMemberApiSuccess(body, action);

    return body;
  });
