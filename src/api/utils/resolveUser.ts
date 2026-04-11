import prisma from '../../db';

/**
 * Resolve or create a platform-independent userId for an incoming identity.
 *
 * - First call for a given (platform, platformId): creates User + UserIdentity atomically.
 * - Subsequent calls: returns the same userId, updates username/firstName if changed.
 *
 * chatId stays unchanged on existing routes — this only *adds* userId to the request context.
 */
export async function resolveUserId(
  platform: string,
  platformId: string,
  meta?: { username?: string; firstName?: string },
): Promise<string> {
  const identity = await prisma.userIdentity.upsert({
    where: {
      platform_platformId: { platform, platformId },
    },
    update: {
      ...(meta?.username !== undefined && { username: meta.username }),
      ...(meta?.firstName !== undefined && { firstName: meta.firstName }),
    },
    create: {
      platform,
      platformId,
      username: meta?.username ?? null,
      firstName: meta?.firstName ?? null,
      user: { create: {} },
    },
    select: { userId: true },
  });

  return identity.userId;
}
