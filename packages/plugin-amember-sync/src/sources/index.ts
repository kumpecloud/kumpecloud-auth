import type { AMemberSyncConfig } from '../types.js';
import { createApiAMemberDataSource } from './api-source.js';
import { createDatabaseAMemberDataSource } from './database-source.js';
import type { AMemberDataSource } from '../context.js';

export const createAMemberDataSource = (config: AMemberSyncConfig): AMemberDataSource => {
  if (config.inboundMode === 'api') {
    if (!config.apiUrl || !config.apiKey) {
      throw new Error('aMember inbound API sync requires apiUrl and apiKey');
    }

    return createApiAMemberDataSource({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    });
  }

  if (!config.databaseUrl) {
    throw new Error('aMember inbound database sync requires databaseUrl');
  }

  return createDatabaseAMemberDataSource({
    databaseUrl: config.databaseUrl,
    tablePrefix: config.tablePrefix,
  });
};
