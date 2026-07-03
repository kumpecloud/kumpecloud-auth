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
import { assertAMemberOutboundUserProfile } from './sign-up-requirements.js';

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

/** Prevents concurrent outbound provisioning from creating duplicate aMember users. */
const pendingUserProvisioning = new Map<string, Promise<number>>();

const linkLogtoUserToAMember = async ({
  user,
  amemberUserId,
  context,
  logger,
  message,
}: {
  user: AMemberOutboundPushUser;
  amemberUserId: number;
  context: AMemberOutboundContext;
  logger: AMemberSyncLogger;
  message: string;
}) => {
  const customData = setAMemberLinkage(user.customData ?? {}, amemberUserId);

  await context.updateUserCustomData(user.id, customData);
  logger.info(message);

  return amemberUserId;
};

const resolveExistingAMemberUserId = async ({
  user,
  sink,
  plainPassword,
}: {
  user: AMemberOutboundPushUser;
  sink: AMemberDataSink;
  plainPassword?: string;
}) => {
  const linkedId = getAMemberUserIdFromCustomData(user.customData ?? {});

  if (linkedId !== undefined) {
    return linkedId;
  }

  const fields = buildLogtoUserToAMemberFields(user, { plainPassword });

  return sink.findUserByLoginOrEmail({
    login: fields.login,
    email: fields.email,
  });
};

const provisionAMemberUserId = async ({
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
  const existingId = await resolveExistingAMemberUserId({ user, sink, plainPassword });

  if (existingId !== undefined) {
    return linkLogtoUserToAMember({
      user,
      amemberUserId: existingId,
      context,
      logger,
      message: `Linked Logto user ${user.id} to existing aMember user ${existingId}`,
    });
  }

  const fields = buildLogtoUserToAMemberFields(user, { plainPassword });
  assertAMemberOutboundUserProfile(user.profile);

  try {
    const createdId = await sink.createUser(fields);

    return linkLogtoUserToAMember({
      user,
      amemberUserId: createdId,
      context,
      logger,
      message: `Created aMember user ${createdId} for Logto user ${user.id}`,
    });
  } catch (error: unknown) {
    const recoveredId = await sink.findUserByLoginOrEmail({
      login: fields.login,
      email: fields.email,
    });

    if (recoveredId === undefined) {
      throw error;
    }

    return linkLogtoUserToAMember({
      user,
      amemberUserId: recoveredId,
      context,
      logger,
      message: `Recovered aMember linkage for Logto user ${user.id} as user ${recoveredId}`,
    });
  }
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
  const pending = pendingUserProvisioning.get(user.id);

  if (pending) {
    return pending;
  }

  const task = provisionAMemberUserId({
    user,
    sink,
    plainPassword,
    context,
    logger,
  });

  pendingUserProvisioning.set(user.id, task);

  try {
    return await task;
  } finally {
    pendingUserProvisioning.delete(user.id);
  }
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
    assertAMemberOutboundUserProfile(user.profile);
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
