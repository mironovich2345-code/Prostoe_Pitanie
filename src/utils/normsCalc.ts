import { getProfile, upsertProfile } from '../state/profileStore';

export interface NormCalcResult {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function calcAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export function deriveGoal(currentWeightKg: number, desiredWeightKg: number): string {
  const diff = desiredWeightKg - currentWeightKg;
  if (diff < -0.5) return 'cut';
  if (diff > 0.5) return 'bulk';
  return 'maintain';
}

export function calcNorms(sex: string, age: number, heightCm: number, weightKg: number, activity: number, goal: string): NormCalcResult {
  const sexConst = sex === 'male' ? 5 : -161;
  const goalMultipliers: Record<string, number> = { cut: 0.85, maintain: 1.0, bulk: 1.10 };
  const proteinPerKg: Record<string, number> = { cut: 2.0, maintain: 1.8, bulk: 1.8 };
  const fatPerKg: Record<string, number> = { cut: 0.8, maintain: 0.9, bulk: 0.9 };
  const goalKey = goal === 'lose' ? 'cut' : goal === 'gain' ? 'bulk' : goal;
  const goalMultiplier = goalMultipliers[goalKey] ?? 1.0;
  const pPerKg = proteinPerKg[goalKey] ?? 1.8;
  const fPerKg = fatPerKg[goalKey] ?? 0.9;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexConst;
  const tdee = bmr * activity;
  const calories = tdee * goalMultiplier;
  const proteinGrams = weightKg * pPerKg;
  const fatGrams = weightKg * fPerKg;
  const carbGrams = (calories - proteinGrams * 4 - fatGrams * 9) / 4;
  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinGrams),
    fatG: Math.round(fatGrams),
    carbsG: Math.round(Math.max(0, carbGrams)),
  };
}

export async function tryAutoCalcNorms(chatId: number): Promise<void> {
  const profile = await getProfile(chatId);
  if (!profile?.sex || !profile?.birthDate || !profile?.heightCm || !profile?.currentWeightKg || !profile?.activityLevel) return;
  let goalKey: string;
  if (profile.desiredWeightKg != null) {
    goalKey = deriveGoal(profile.currentWeightKg, profile.desiredWeightKg);
  } else if (profile.goalType && ['cut', 'maintain', 'bulk', 'lose', 'gain'].includes(profile.goalType)) {
    goalKey = profile.goalType === 'lose' ? 'cut' : profile.goalType === 'gain' ? 'bulk' : profile.goalType;
  } else {
    goalKey = 'maintain';
  }
  if (!['cut', 'maintain', 'bulk'].includes(goalKey)) return;
  const age = calcAge(profile.birthDate);
  if (age < 10 || age > 120) return;
  const norms = calcNorms(profile.sex, age, profile.heightCm, profile.currentWeightKg, profile.activityLevel, goalKey);
  await upsertProfile(chatId, {
    dailyCaloriesKcal: norms.calories,
    dailyProteinG: norms.proteinG,
    dailyFatG: norms.fatG,
    dailyCarbsG: norms.carbsG,
    dailyFiberG: 25,
  });
}
