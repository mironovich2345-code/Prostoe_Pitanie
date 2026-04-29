import prisma from '../db';

export interface UpdateProfileData {
  heightCm?: number;
  currentWeightKg?: number;
  goalType?: string;
  dailyCaloriesKcal?: number;
  dailyProteinG?: number;
  dailyFatG?: number;
  dailyCarbsG?: number;
  dailyFiberG?: number;
  sex?: string;
  birthDate?: Date;
  activityLevel?: number;
  notificationsEnabled?: boolean;
  notificationCount?: number;
  notificationTimes?: string;
  desiredWeightKg?: number;
  city?: string;
  timezone?: string;
  preferredName?: string;
  goalStartWeightKg?: number | null;
  goalStartedAt?: Date | null;
}

export async function getProfile(chatId: number) {
  return prisma.userProfile.findUnique({
    where: { chatId: String(chatId) },
  });
}

export async function upsertProfile(chatId: number, data: UpdateProfileData, userId?: string) {
  const strChatId = String(chatId);

  if (userId) {
    // For cross-platform linked accounts (TG + MAX sharing one User), a profile may already exist
    // under a different chatId.  Update it in-place to avoid a unique-constraint error on userId.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma.userProfile as any).findUnique({ where: { userId } });
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prisma.userProfile as any).update({ where: { userId }, data });
    }
  }

  const connectUser = userId ? { user: { connect: { id: userId } } } : {};
  return prisma.userProfile.upsert({
    where: { chatId: strChatId },
    update: { ...data, ...(userId ? { userId } : {}) },
    create: { chatId: strChatId, ...data, ...connectUser },
  });
}

export async function getAllOnboardedProfiles(): Promise<{
  chatId: string;
  timezone: string | null;
  notificationTimes: string | null;
  notificationCount: number;
}[]> {
  return prisma.userProfile.findMany({
    where: {
      heightCm: { not: null },
      currentWeightKg: { not: null },
      notificationsEnabled: { not: false },
    },
    select: { chatId: true, timezone: true, notificationTimes: true, notificationCount: true },
  });
}
