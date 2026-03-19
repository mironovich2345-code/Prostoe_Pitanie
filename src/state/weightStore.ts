import prisma from '../db';

export async function addWeightEntry(chatId: number, weightKg: number) {
  return prisma.weightEntry.create({
    data: { chatId: String(chatId), weightKg },
  });
}

export async function getRecentWeightEntries(chatId: number) {
  return prisma.weightEntry.findMany({
    where: { chatId: String(chatId) },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}

export async function countWeightEntries(chatId: number): Promise<number> {
  return prisma.weightEntry.count({ where: { chatId: String(chatId) } });
}

export async function getFirstWeightEntry(chatId: number) {
  return prisma.weightEntry.findFirst({
    where: { chatId: String(chatId) },
    orderBy: { createdAt: 'asc' },
  });
}
