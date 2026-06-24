import type { AMemberSyncConfig } from '../types.js';
import { createApiAMemberDataSource } from './api-source.js';
import { createDatabaseAMemberDataSource } from './database-source.js';
import type { AMemberDataSource } from '../context.js';

export const createAMemberDataSource = (config: AMemberSyncConfig): AMemberDataSource => {
  if (config.mode === 'api') {
    return createApiAMemberDataSource({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    });
  }

  return createDatabaseAMemberDataSource({
    databaseUrl: config.databaseUrl,
    tablePrefix: config.tablePrefix,
  });
};
