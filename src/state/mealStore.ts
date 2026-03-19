import prisma from '../db';

export interface AddMealData {
  text: string;
  mealType: string;
  sourceType?: string;
  photoFileId?: string;
  voiceFileId?: string;
  createdAt?: Date;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function addMeal(chatId: number, data: AddMealData) {
  return prisma.mealEntry.create({
    data: {
      chatId: String(chatId),
      text: data.text,
      mealType: data.mealType,
      sourceType: data.sourceType ?? 'text',
      photoFileId: data.photoFileId,
      voiceFileId: data.voiceFileId,
      caloriesKcal: data.caloriesKcal ?? null,
      proteinG: data.proteinG ?? null,
      fatG: data.fatG ?? null,
      carbsG: data.carbsG ?? null,
      fiberG: data.fiberG ?? null,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    },
  });
}

export async function getMealsForDate(chatId: number, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return prisma.mealEntry.findMany({
    where: {
      chatId: String(chatId),
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getTodayMeals(chatId: number) {
  const { start, end } = todayRange();
  return prisma.mealEntry.findMany({
    where: {
      chatId: String(chatId),
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function deleteLastTodayMeal(chatId: number) {
  const { start, end } = todayRange();
  const last = await prisma.mealEntry.findFirst({
    where: {
      chatId: String(chatId),
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!last) return undefined;
  await prisma.mealEntry.delete({ where: { id: last.id } });
  return last;
}

export async function updateMealNutrition(
  id: number,
  data: { caloriesKcal: number; proteinG: number; fatG: number; carbsG: number; fiberG: number | null }
) {
  return prisma.mealEntry.update({ where: { id }, data });
}

export async function clearTodayMeals(chatId: number): Promise<number> {
  const { start, end } = todayRange();
  const result = await prisma.mealEntry.deleteMany({
    where: {
      chatId: String(chatId),
      createdAt: { gte: start, lte: end },
    },
  });
  return result.count;
}
