type PendingAction = 'awaiting_meal_type' | 'awaiting_meal_text' | 'awaiting_meal_photo' | 'awaiting_meal_voice' | 'awaiting_meal_input' | 'awaiting_height' | 'awaiting_weight' | 'awaiting_weight_log' | 'onboarding_height' | 'onboarding_weight' | 'onboarding_goal' | 'onboarding_sex' | 'onboarding_birthdate' | 'onboarding_activity' | 'awaiting_sex' | 'awaiting_birthdate' | 'awaiting_activity' | 'awaiting_nutrition' | 'awaiting_norms' | 'awaiting_draft_edit' | 'awaiting_draft_edit_photo' | 'awaiting_draft_edit_voice' | 'awaiting_desired_weight' | 'onboarding_desired_weight' | 'awaiting_city' | 'onboarding_city' | 'awaiting_notif_time';

interface PendingState {
  action: PendingAction;
  mealType?: string;
  sourceType?: 'text' | 'photo' | 'voice';
  mealEntryId?: number;
}

const pending = new Map<number, PendingState>();

export function setPending(chatId: number, state: PendingState): void {
  pending.set(chatId, state);
}

export function getPending(chatId: number): PendingState | undefined {
  return pending.get(chatId);
}

export function clearPending(chatId: number): void {
  pending.delete(chatId);
}

// ── Meal draft (результат анализа до сохранения) ──────────────────────

export interface MealDraft {
  text: string;
  composition?: string;
  sourceType: 'text' | 'photo' | 'voice';
  photoFileId?: string;
  voiceFileId?: string;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  weightG?: number | null;
  targetDate?: Date;
}

const drafts = new Map<number, MealDraft>();

export function setDraft(chatId: number, draft: MealDraft): void {
  drafts.set(chatId, draft);
}

export function getDraft(chatId: number): MealDraft | undefined {
  return drafts.get(chatId);
}

export function clearDraft(chatId: number): void {
  drafts.delete(chatId);
}
