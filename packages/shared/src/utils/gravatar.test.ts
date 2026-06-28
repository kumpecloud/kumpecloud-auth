import { describe, expect, it } from 'vitest';

import { getGravatarUrl, resolveUserAvatar } from './gravatar.js';

describe('getGravatarUrl()', () => {
  it('returns Gravatar URL with MD5 hash of normalized email', () => {
    expect(getGravatarUrl('  User@Example.com  ')).toBe(
      'https://www.gravatar.com/avatar/b58996c504c5638798eb6b511e6f49af'
    );
  });

  it('returns null for empty email', () => {
    expect(getGravatarUrl('   ')).toBeNull();
  });
});

describe('resolveUserAvatar()', () => {
  const user = {
    avatar: null,
    primaryEmail: 'user@example.com',
  };

  it('returns stored avatar when present', () => {
    expect(
      resolveUserAvatar(
        { avatar: 'https://example.com/avatar.png', primaryEmail: 'user@example.com' },
        true
      )
    ).toBe('https://example.com/avatar.png');
  });

  it('returns Gravatar URL when enabled and avatar is missing', () => {
    expect(resolveUserAvatar(user, true)).toBe(
      'https://www.gravatar.com/avatar/b58996c504c5638798eb6b511e6f49af'
    );
  });

  it('returns null when disabled and avatar is missing', () => {
    expect(resolveUserAvatar(user, false)).toBeNull();
  });

  it('treats undefined avatar the same as null', () => {
    expect(
      resolveUserAvatar({ primaryEmail: 'user@example.com' }, true)
    ).toBe('https://www.gravatar.com/avatar/b58996c504c5638798eb6b511e6f49af');
  });
});
