export type TrainerVerificationStatus = 'pending' | 'verified' | 'rejected' | 'blocked';
export type ReminderMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealReminder {
  id: number;
  mealType: ReminderMealType;
  time: string;
  enabled: boolean;
}
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'past_due' | 'canceled';
export type AppMode = 'client' | 'coach';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface UserProfile {
  chatId?: string;
  heightCm: number | null;
  currentWeightKg: number | null;
  desiredWeightKg: number | null;
  dailyCaloriesKcal: number | null;
  dailyProteinG: number | null;
  dailyFatG: number | null;
  dailyCarbsG: number | null;
  dailyFiberG: number | null;
  goalType: string | null;
  notificationsEnabled: boolean;
  notificationCount: number;
  notificationTimes: string | null;
  city: string | null;
  timezone: string | null;
  preferredName: string | null;
  referralCode: string | null;
  sex: string | null;
  birthDate: string | null;
  activityLevel: number | null;
}

export interface TrainerProfileInfo {
  verificationStatus: TrainerVerificationStatus;
  bio: string | null;
  specialization: string | null;
  referralCode: string | null;
  fullName: string | null;
  socialLink: string | null;
  documentLink: string | null;
  appliedAt: string | null;
}

export interface SubscriptionInfo {
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
}

export interface ConnectedTrainerInfo {
  trainerId: string;
  name: string | null;
  fullHistoryAccess: boolean;
  canViewPhotos: boolean;
  connectedAt: string;
}

export interface TrainerLookupResult {
  trainerId: string;
  fullName: string | null;
  specialization: string | null;
  bio: string | null;
}

export interface TrainerConnectionCode {
  code: string;
  link: string;
  expiresAt: string;
}

export interface TrainerRating {
  id: number;
  trainerId: string;
  clientId: string;
  targetType: 'meal' | 'day';
  targetId: string;
  rating: string;
  createdAt: string;
}

export interface BootstrapData {
  chatId: string;
  telegramUser: TelegramUser;
  profile: UserProfile | null;
  trainerProfile: TrainerProfileInfo | null;
  subscription: SubscriptionInfo | null;
  connectedTrainer: ConnectedTrainerInfo | null;
}

export interface MealEntry {
  id: number;
  chatId: string;
  text: string;
  mealType: string;
  sourceType: string;
  photoFileId: string | null;
  voiceFileId: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  createdAt: string;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export interface TodayNutritionData {
  meals: MealEntry[];
  totals: NutritionTotals;
  counts: Record<string, number>;
}
