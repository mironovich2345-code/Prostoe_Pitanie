export type TrainerVerificationStatus = 'pending' | 'verified' | 'rejected' | 'blocked';
export type TrainerDocType = 'diploma' | 'certificate' | 'other';

export interface TrainerDocument {
  id: number;
  docType: TrainerDocType;
  title: string | null;
  mimeType: string; // 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
  createdAt: string;
}
export type ReminderMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealReminder {
  id: number;
  mealType: ReminderMealType | 'weight';
  time: string;
  dayOfWeek?: string | null;
  enabled: boolean;
}
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'past_due' | 'canceled';
export type AppMode = 'client' | 'coach' | 'company' | 'admin';

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
  avatarData: string | null;
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
  avatarData: string | null;
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
  fullName: string | null;
  avatarData: string | null;
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
  expiresAt?: string; // kept for backwards compat, no longer used
}

export interface TrainerRating {
  id: number;
  trainerId: string;
  clientId: string;
  targetType: 'meal' | 'day';
  targetId: string;
  rating: string;
  createdAt: string;
  // enriched by GET /api/ratings/my
  mealType?: string | null;
  mealCreatedAt?: string | null;
}

export type TrainerOfferType = 'one_time' | 'lifetime' | 'month_1rub';

export interface BootstrapData {
  chatId: string;
  telegramUser: TelegramUser;
  profile: UserProfile | null;
  trainerProfile: TrainerProfileInfo | null;
  subscription: SubscriptionInfo | null;
  connectedTrainer: ConnectedTrainerInfo | null;
  /** Canonical offer type for this user; null if no referral or non-offer referral. */
  trainerOfferType: TrainerOfferType | null;
  /** Source of the referral that set the offer; null if none. */
  referralSource: 'trainer' | 'company' | null;
}

export interface MealEntry {
  id: number;
  chatId: string;
  text: string;
  mealType: string;
  sourceType: string;
  photoFileId: string | null;
  voiceFileId: string | null;
  photoData?: string | null; // not included in bulk responses; use /media endpoint instead
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  createdAt: string;
}

export interface FoodAnalysis {
  name: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';
  items?: string[];
  composition?: string;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  weightG: number | null;
  ingredients?: string[];
  confidence?: 'high' | 'medium' | 'low';
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export interface TrainerReview {
  id: number;
  clientId: string;
  trainerId: string;
  rating: number;
  reviewText: string | null;
  allowTrainerComment: boolean;
  trainerComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerReviewWithClient extends TrainerReview {
  clientName: string | null;
}

export interface NutritionInsight {
  bannerTitle: string;
  bannerText: string;
  severity: 'neutral' | 'good' | 'warning';
  nextMealSuggestion: string;
  mealAdvice: string[];
}

export interface TodayNutritionData {
  meals: MealEntry[];
  totals: NutritionTotals;
  counts: Record<string, number>;
}
