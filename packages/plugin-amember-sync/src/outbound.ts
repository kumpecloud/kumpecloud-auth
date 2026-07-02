import { parseProductIdFromRoleName } from './constants.js';
import {
  buildLogtoUserToAMemberFields,
  markLogtoGrantedProduct,
  setAMemberLinkage,
  touchAMemberOutboundPush,
  unmarkLogtoGrantedProduct,
  type LogtoUserForAMemberOutbound,
} from './profile-fields.js';
import { createApiAMemberDataSink, type AMemberDataSink } from './sinks/api-sink.js';
import { isRoleOutboundSyncEnabled, type AMemberOutboundConfig, type AMemberSyncLogger } from './types.js';
import { getAMemberUserIdFromCustomData } from './utils.js';

export type AMemberOutboundPushUser = LogtoUserForAMemberOutbound & {
  id: string;
  customData?: Record<string, unknown>;
};

export type AMemberOutboundContext = {
  updateUserCustomData: (userId: string, customData: Record<string, unknown>) => Promise<void>;
};

const createSink = (config: AMemberOutboundConfig): AMemberDataSink => {
  return createApiAMemberDataSink({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
  });
};

const resolveAMemberUserId = async ({
  user,
  sink,
  plainPassword,
  context,
  logger,
}: {
  user: AMemberOutboundPushUser;
  sink: AMemberDataSink;
  plainPassword?: string;
  context: AMemberOutboundContext;
  logger: AMemberSyncLogger;
}): Promise<number> => {
  const existingId = getAMemberUserIdFromCustomData(user.customData ?? {});

  if (existingId !== undefined) {
    return existingId;
  }

  const fields = buildLogtoUserToAMemberFields(user, { plainPassword });
  const createdId = await sink.createUser(fields);
  const customData = setAMemberLinkage(user.customData ?? {}, createdId);

  await context.updateUserCustomData(user.id, customData);
  logger.info(`Created aMember user ${createdId} for Logto user ${user.id}`);

  return createdId;
};

export const pushLogtoUserToAMember = async ({
  config,
  context,
  logger,
  user,
  plainPassword,
}: {
  config: AMemberOutboundConfig;
  context: AMemberOutboundContext;
  logger: AMemberSyncLogger;
  user: AMemberOutboundPushUser;
  plainPassword?: string;
}): Promise<void> => {
  const sink = createSink(config);
  const hadLinkedAMemberUser = getAMemberUserIdFromCustomData(user.customData ?? {}) !== undefined;
  const amemberUserId = await resolveAMemberUserId({
    user,
    sink,
    plainPassword,
    context,
    logger,
  });

  const fields = buildLogtoUserToAMemberFields(user, { plainPassword });

  if (hadLinkedAMemberUser) {
    await sink.updateUser(amemberUserId, fields);
  } else if (plainPassword) {
    await sink.updateUser(amemberUserId, { pass: plainPassword });
  }

  const customData = touchAMemberOutboundPush(
    setAMemberLinkage(user.customData ?? {}, amemberUserId)
  );

  await context.updateUserCustomData(user.id, customData);
  logger.info(`Pushed Logto user ${user.id} profile to aMember user ${amemberUserId}`);
};

export const pushLogtoPasswordToAMember = async ({
  config,
  context,
  logger,
  user,
  plainPassword,
}: {
  config: AMemberOutboundConfig;
  context: AMemberOutboundContext;
  logger: AMemberSyncLogger;
  user: AMemberOutboundPushUser;
  plainPassword: string;
}): Promise<void> => {
  const sink = createSink(config);
  const amemberUserId = await resolveAMemberUserId({
    user,
    sink,
    plainPassword,
    context,
    logger,
  });

  await sink.updateUser(amemberUserId, { pass: plainPassword });

  const customData = touchAMemberOutboundPush(
    setAMemberLinkage(user.customData ?? {}, amemberUserId)
  );

  await context.updateUserCustomData(user.id, customData);
  logger.info(`Pushed password for Logto user ${user.id} to aMember user ${amemberUserId}`);
};

export const pushLogtoRoleGrantsToAMember = async ({
  config,
  context,
  logger,
  user,
  roleNames,
  revokedRoleNames = [],
}: {
  config: AMemberOutboundConfig;
  context: AMemberOutboundContext;
  logger: AMemberSyncLogger;
  user: AMemberOutboundPushUser;
  roleNames: string[];
  revokedRoleNames?: string[];
}): Promise<void> => {
  if (!isRoleOutboundSyncEnabled(config)) {
    return;
  }

  const grantedProductIds = roleNames
    .map((roleName) => parseProductIdFromRoleName(roleName))
    .filter((productId): productId is number => productId !== undefined);

  const revokedProductIds = revokedRoleNames
    .map((roleName) => parseProductIdFromRoleName(roleName))
    .filter((productId): productId is number => productId !== undefined);

  if (grantedProductIds.length === 0 && revokedProductIds.length === 0) {
    return;
  }

  const sink = createSink(config);
  const amemberUserId = await resolveAMemberUserId({
    user,
    sink,
    context,
    logger,
  });

  let customData = user.customData ?? {};

  for (const productId of grantedProductIds) {
    await sink.grantLifetimeAccess(amemberUserId, productId);
    customData = markLogtoGrantedProduct(customData, productId);
    logger.info(
      `Granted lifetime aMember access for product ${productId} to user ${amemberUserId}`
    );
  }

  for (const productId of revokedProductIds) {
    await sink.revokeProductAccess(amemberUserId, productId);
    customData = unmarkLogtoGrantedProduct(customData, productId);
    logger.info(`Revoked aMember access for product ${productId} from user ${amemberUserId}`);
  }

  customData = touchAMemberOutboundPush(setAMemberLinkage(customData, amemberUserId));
  await context.updateUserCustomData(user.id, customData);
};
