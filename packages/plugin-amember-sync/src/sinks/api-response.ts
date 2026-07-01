import { HTTPError } from 'got';

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

export const assertAMemberApiSuccess = (body: unknown, action: string): void => {
  if (body === undefined || body === null) {
    throw new Error(`aMember API returned no response body for ${action}`);
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`aMember API returned an unexpected response for ${action}`);
  }

  const response = body as Record<string, unknown>;

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
  assertAMemberApiSuccess(body, action);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`aMember API ${action} did not return a ${entityName} id`);
  }

  const record = body as Record<string, unknown>;

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
      const body = error.response.body;

      if (body && typeof body === 'object' && !Array.isArray(body)) {
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
    const body = await request();
    assertAMemberApiSuccess(body, action);

    return body;
  });
