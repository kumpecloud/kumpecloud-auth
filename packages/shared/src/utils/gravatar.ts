import crypto from 'node:crypto';

const gravatarBaseUrl = 'https://www.gravatar.com/avatar';

/**
 * Build a Gravatar avatar URL from an email address.
 *
 * @see https://docs.gravatar.com/api/avatars/images/
 */
export const getGravatarUrl = (email: string): string | null => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const hash = crypto.createHash('md5').update(normalizedEmail).digest('hex');

  return `${gravatarBaseUrl}/${hash}`;
};

type UserAvatarSource = {
  avatar?: string | null;
  primaryEmail?: string | null;
};

/**
 * Resolve the avatar URL for a user. When Gravatar is enabled and the user has no custom avatar,
 * fall back to their Gravatar image derived from primary email.
 */
export const resolveUserAvatar = (
  user: UserAvatarSource,
  gravatarEnabled: boolean
): string | null => {
  const avatar = user.avatar ?? null;

  if (avatar) {
    return avatar;
  }

  if (!gravatarEnabled || !user.primaryEmail) {
    return null;
  }

  return getGravatarUrl(user.primaryEmail);
};
