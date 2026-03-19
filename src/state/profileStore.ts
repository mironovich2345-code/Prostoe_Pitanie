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
}

export async function getProfile(chatId: number) {
  return prisma.userProfile.findUnique({
    where: { chatId: String(chatId) },
  });
}

export async function upsertProfile(chatId: number, data: UpdateProfileData) {
  return prisma.userProfile.upsert({
    where: { chatId: String(chatId) },
    update: data,
    create: { chatId: String(chatId), ...data },
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
