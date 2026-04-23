declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string }; start_param?: string };
        version: string;
        ready(): void;
        expand(): void;
        close(): void;
        BackButton: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void; isVisible: boolean };
        MainButton: { text: string; show(): void; hide(): void; onClick(fn: () => void): void; isVisible: boolean };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
      };
    };
    /** MAX messenger mini-app bridge (TamTam-compatible) */
    WebApp?: {
      initData: string;
      ready?(): void;
      expand?(): void;
    };
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

function detectPlatform(): 'telegram' | 'max' {
  if (window.WebApp && !window.Telegram?.WebApp) return 'max';
  return 'telegram';
}

export function getPlatformInitData(): string {
  if (window.Telegram?.WebApp?.initData) return window.Telegram.WebApp.initData;
  if (window.WebApp?.initData) return window.WebApp.initData;
  // MAX fallback: initData may arrive via location hash as #WebAppData=<encoded>
  const hash = location.hash;
  if (hash.startsWith('#WebAppData=')) return decodeURIComponent(hash.slice(12));
  return '';
}

/** @deprecated use getPlatformInitData() */
export function getTelegramInitData(): string {
  return getPlatformInitData();
}

function authHeaders(): Record<string, string> {
  const platform = detectPlatform();
  return { [platform === 'max' ? 'x-max-init-data' : 'x-telegram-init-data']: getPlatformInitData() };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<import('../types').BootstrapData>('/api/bootstrap'),
  nutritionToday: () => request<import('../types').TodayNutritionData>('/api/nutrition/today'),
  nutritionDiary: (date?: string) => request<{ date: string; meals: import('../types').MealEntry[] }>(`/api/nutrition/diary${date ? `?date=${date}` : ''}`),
  nutritionStats: (days?: number) => request<{ days: number; meals: import('../types').MealEntry[] }>(`/api/nutrition/stats${days ? `?days=${days}` : ''}`),
  nutritionStatsRange: (from: string, to: string) =>
    request<{ days: number; meals: import('../types').MealEntry[] }>(`/api/nutrition/stats?from=${from}&to=${to}`),
  profile: () => request<{ profile: import('../types').UserProfile | null; weightHistory: Array<{ id: number; weightKg: number; createdAt: string }> }>('/api/profile'),
  reminders: () => request<{ reminders: import('../types').MealReminder[] }>('/api/reminders'),
  createReminder: (data: { mealType: string; time: string; dayOfWeek?: string; enabled?: boolean }) =>
    request<{ reminder: import('../types').MealReminder }>('/api/reminders', { method: 'POST', body: JSON.stringify(data) }),
  patchReminder: (id: number, data: { time?: string; enabled?: boolean; dayOfWeek?: string }) =>
    request<{ reminder: import('../types').MealReminder }>(`/api/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReminder: (id: number) =>
    request<{ ok: boolean }>(`/api/reminders/${id}`, { method: 'DELETE' }),
  patchProfileData: (data: { heightCm?: number; currentWeightKg?: number; desiredWeightKg?: number; sex?: string; birthDate?: string; activityLevel?: number; city?: string; timezone?: string; preferredName?: string; goalType?: string }) =>
    request<{ ok: boolean; profile: import('../types').UserProfile | null }>('/api/profile/data', { method: 'PATCH', body: JSON.stringify(data) }),
  patchProfileAvatar: (avatarData: string | null) =>
    request<{ ok: boolean }>('/api/profile/avatar', { method: 'PATCH', body: JSON.stringify({ avatarData }) }),
  logWeight: (weightKg: number) =>
    request<{ ok: boolean; weightEntry: { id: number; weightKg: number; createdAt: string } }>('/api/profile/weight', { method: 'POST', body: JSON.stringify({ weightKg }) }),
  subscription: () => request<{ subscription: import('../types').SubscriptionInfo | null }>('/api/subscription'),
  trainerClients: () => request<{ clients: Array<{ link: unknown; profile: import('../types').UserProfile | null; subscription: import('../types').SubscriptionInfo | null }> }>('/api/trainer/clients'),
  trainerClientCard: (clientId: string) => request<{ link: unknown; profile: import('../types').UserProfile | null; subscription: import('../types').SubscriptionInfo | null }>(`/api/trainer/clients/${clientId}`),
  trainerClientStats: (clientId: string) => request<{ todayMeals: import('../types').MealEntry[]; todayCalories: number; recentMeals: import('../types').MealEntry[]; weightHistory: Array<{ id: number; weightKg: number; createdAt: string }>; profile: import('../types').UserProfile | null; canViewPhotos: boolean; displayName: string }>(`/api/trainer/clients/${clientId}/stats`),
  trainerClientStatsRange: (clientId: string, from: string, to: string) =>
    request<{ meals: import('../types').MealEntry[] }>(`/api/trainer/clients/${clientId}/stats-range?from=${from}&to=${to}`),
  trainerAlerts: () => request<{ notLoggedToday: string[]; expiringSoon: unknown[]; totalClients: number; activeToday: number }>('/api/trainer/alerts'),
  trainerRewards: () => request<{ rewards: unknown[]; summary: { total: number; available: number; paidOut: number } }>('/api/trainer/rewards'),
  expertApply: (data: { fullName: string; socialLink: string; documentLink?: string; specialization?: string; bio?: string; verificationPhotoData?: string; applicantType?: 'expert' | 'company' }) =>
    request<{ trainerProfile: import('../types').TrainerProfileInfo }>('/api/expert/apply', { method: 'POST', body: JSON.stringify(data) }),
  trainerDocuments: () =>
    request<{ documents: import('../types').TrainerDocument[] }>('/api/trainer/documents'),
  trainerDocumentUpload: (data: { docType: string; title?: string; fileData: string }) =>
    request<{ document: import('../types').TrainerDocument }>('/api/trainer/documents', { method: 'POST', body: JSON.stringify(data) }),
  trainerDocumentDelete: (id: number) =>
    request<{ ok: boolean }>(`/api/trainer/documents/${id}`, { method: 'DELETE' }),
  trainerDocumentFile: async (id: number): Promise<string> => {
    // Fetches the document with auth headers and returns a blob URL for inline display
    const res = await fetch(`${BASE_URL}/api/trainer/documents/${id}/file`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Document fetch failed');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  disconnectTrainer: () => request<{ ok: boolean }>('/api/client/trainer', { method: 'DELETE' }),
  setTrainerHistoryAccess: (fullAccess: boolean) =>
    request<{ ok: boolean; fullHistoryAccess: boolean }>('/api/client/trainer/history-access', { method: 'PATCH', body: JSON.stringify({ fullAccess }) }),
  setTrainerAccess: (fullHistoryAccess: boolean, canViewPhotos: boolean) =>
    request<{ ok: boolean }>('/api/client/trainer/access', { method: 'PATCH', body: JSON.stringify({ fullHistoryAccess, canViewPhotos }) }),
  // Trainer connection code
  trainerMyCode: () =>
    request<import('../types').TrainerConnectionCode>('/api/trainer/my-code'),
  trainerRefreshCode: () =>
    request<import('../types').TrainerConnectionCode>('/api/trainer/my-code/refresh', { method: 'POST' }),
  // Client: connect to trainer
  trainerLookup: (code: string) =>
    request<import('../types').TrainerLookupResult>('/api/client/trainer/lookup', { method: 'POST', body: JSON.stringify({ code }) }),
  trainerConnect: (data: { code: string; fullHistoryAccess: boolean; canViewPhotos: boolean }) =>
    request<{ ok: boolean }>('/api/client/trainer/connect', { method: 'POST', body: JSON.stringify(data) }),
  trainerList: () =>
    request<{ trainers: import('../types').PublicTrainerListItem[] }>('/api/client/trainers'),
  trainerPublicProfile: (trainerId: string) =>
    request<{ trainer: import('../types').PublicTrainerProfile }>(`/api/client/trainers/${encodeURIComponent(trainerId)}`),
  trainerPublicDocumentFile: async (trainerId: string, docId: number): Promise<string> => {
    const res = await fetch(`${BASE_URL}/api/client/trainers/${encodeURIComponent(trainerId)}/documents/${docId}/file`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Document fetch failed');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  trainerLookupById: (trainerId: string) =>
    request<import('../types').TrainerLookupResult>(`/api/client/trainer/lookup-by-id?trainerId=${encodeURIComponent(trainerId)}`),
  trainerConnectDirect: (data: { trainerId: string; fullHistoryAccess: boolean; canViewPhotos: boolean }) =>
    request<{ ok: boolean }>('/api/client/trainer/connect-direct', { method: 'POST', body: JSON.stringify(data) }),
  // Ratings
  rateMeal: (mealId: number, rating: string) =>
    request<{ rating: import('../types').TrainerRating }>(`/api/ratings/meal/${mealId}`, { method: 'POST', body: JSON.stringify({ rating }) }),
  rateDay: (date: string, clientId: string, rating: string) =>
    request<{ rating: import('../types').TrainerRating }>(`/api/ratings/day/${date}`, { method: 'POST', body: JSON.stringify({ clientId, rating }) }),
  ratingsForClient: (clientId: string) =>
    request<{ ratings: import('../types').TrainerRating[] }>(`/api/ratings/for-client/${clientId}`),
  myRatings: () =>
    request<{ ratings: import('../types').TrainerRating[] }>('/api/ratings/my'),
  nutritionDeleteMeal: (mealId: number) =>
    request<{ ok: boolean }>(`/api/nutrition/meals/${mealId}`, { method: 'DELETE' }),
  savedMealList: () =>
    request<{ savedMeals: import('../types').SavedMeal[] }>('/api/nutrition/saved-meals'),
  savedMealCreate: (data: { title: string; totalWeightG?: number | null; caloriesKcal?: number | null; proteinG?: number | null; fatG?: number | null; carbsG?: number | null; fiberG?: number | null; mealType?: string | null; notes?: string | null }) =>
    request<{ savedMeal: import('../types').SavedMeal }>('/api/nutrition/saved-meals', { method: 'POST', body: JSON.stringify(data) }),
  savedMealUpdate: (id: number, data: { title: string }) =>
    request<{ savedMeal: import('../types').SavedMeal }>(`/api/nutrition/saved-meals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  savedMealDelete: (id: number) =>
    request<{ ok: boolean }>(`/api/nutrition/saved-meals/${id}`, { method: 'DELETE' }),
  savedMealAddToDiary: (id: number, mealType: string, portionGrams?: number) =>
    request<{ ok: boolean; meal: import('../types').MealEntry }>(`/api/nutrition/saved-meals/${id}/add`, { method: 'POST', body: JSON.stringify({ mealType, portionGrams }) }),
  nutritionMealMedia: async (mealId: number): Promise<{ url: string; type: string }> => {
    const result = await request<{ url: string; type: string }>(`/api/nutrition/meals/${mealId}/media`);
    // If the server returned a backend stream URL, fetch it with auth headers and create a blob URL
    // so <img> and <audio> elements can use it without auth headers.
    if (result.url.startsWith('/api/')) {
      const streamRes = await fetch(`${BASE_URL}${result.url}`, {
        headers: authHeaders(),
      });
      if (!streamRes.ok) throw new Error('Media stream failed');
      const blob = await streamRes.blob();
      return { url: URL.createObjectURL(blob), type: result.type };
    }
    return result;
  },
  nutritionAnalyze: (text: string) =>
    request<import('../types').FoodAnalysis>('/api/nutrition/analyze', { method: 'POST', body: JSON.stringify({ text }) }),
  nutritionAnalyzeIngredients: (text: string) =>
    request<import('../types').FoodAnalysis>('/api/nutrition/analyze-ingredients', { method: 'POST', body: JSON.stringify({ text }) }),
  nutritionAnalyzePhoto: (imageData: string) =>
    request<import('../types').FoodAnalysis>('/api/nutrition/analyze-photo', { method: 'POST', body: JSON.stringify({ imageData }) }),
  nutritionRefinePhoto: (imageData: string, userContext: string) =>
    request<import('../types').FoodAnalysis>('/api/nutrition/analyze-photo/refine', { method: 'POST', body: JSON.stringify({ imageData, userContext }) }),
  nutritionAdd: (data: { text: string; mealType: string; sourceType: string; caloriesKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null; fiberG: number | null; imageData?: string }) =>
    request<{ ok: boolean; meal: import('../types').MealEntry }>('/api/nutrition/add', { method: 'POST', body: JSON.stringify(data) }),
  nutritionInsight: (date: string) =>
    request<import('../types').NutritionInsight>(`/api/nutrition/insight?date=${date}`),
  nutritionInsightWeek: (from: string, to: string) =>
    request<import('../types').NutritionInsight>(`/api/nutrition/insight/week?from=${from}&to=${to}`),
  myTrainerReview: () =>
    request<{ review: import('../types').TrainerReview | null }>('/api/reviews/my-trainer'),
  submitTrainerReview: (data: { rating: number; reviewText?: string; allowTrainerComment: boolean }) =>
    request<{ review: import('../types').TrainerReview }>('/api/reviews/my-trainer', { method: 'PUT', body: JSON.stringify(data) }),
  trainerReviews: () =>
    request<{ reviews: import('../types').TrainerReviewWithClient[]; avgRating: number | null }>('/api/reviews/trainer'),
  trainerPatchReviewComment: (id: number, trainerComment: string) =>
    request<{ review: import('../types').TrainerReview }>(`/api/reviews/trainer/${id}/comment`, { method: 'PATCH', body: JSON.stringify({ trainerComment }) }),
  trainerPatchProfile: (data: { fullName?: string; avatarData?: string | null; bio?: string; socialLink?: string }) =>
    request<{ ok: boolean; fullName: string | null; avatarData: string | null; bio: string | null; socialLink: string | null }>('/api/trainer/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  trainerSetClientAlias: (clientId: string, alias: string) =>
    request<{ ok: boolean; clientAlias: string | null }>(`/api/trainer/clients/${encodeURIComponent(clientId)}/alias`, { method: 'PATCH', body: JSON.stringify({ alias }) }),
  referralMe: () =>
    request<{ code: string; link: string; invitedCount: number }>('/api/referral/me'),
  referralMyInvited: () =>
    request<{ invited: Array<{ displayName: string | null; username: string | null; joinedAt: string }> }>('/api/referral/my-invited'),
  referralApply: (code: string) =>
    request<{ ok: boolean }>('/api/referral/apply', { method: 'POST', body: JSON.stringify({ code }) }),
  // ─── Admin API ──────────────────────────────────────────────────────────────
  adminApplications: () =>
    request<{ applications: Array<{ chatId: string; fullName: string | null; socialLink: string | null; specialization: string | null; bio: string | null; verificationPhotoData: string | null; appliedAt: string | null }> }>('/api/admin/applications'),
  adminApprove: (chatId: string) =>
    request<{ ok: boolean; verificationStatus: string }>(`/api/admin/applications/${encodeURIComponent(chatId)}/approve`, { method: 'POST' }),
  adminReject: (chatId: string, note?: string) =>
    request<{ ok: boolean; verificationStatus: string }>(`/api/admin/applications/${encodeURIComponent(chatId)}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  adminExperts: () =>
    request<{ experts: Array<{ chatId: string; fullName: string | null; specialization: string | null; verifiedAt: string | null; socialLink: string | null }> }>('/api/admin/experts'),
  adminRevokeExpert: (chatId: string) =>
    request<{ ok: boolean }>(`/api/admin/experts/${encodeURIComponent(chatId)}/revoke`, { method: 'POST' }),
  adminPayouts: () =>
    request<{ payouts: Array<{ id: number; trainerId: string; trainerName: string | null; referredChatId: string; planId: string; amountRub: number; status: string; holdUntil: string | null; paidAt: string | null; createdAt: string }> }>('/api/admin/payouts'),
  adminPayoutRequests: () =>
    request<{ requests: Array<{ id: number; trainerId: string; trainerName: string | null; specialization: string | null; amountRub: number; requisites: Record<string, string> | null; rewardIds: number[]; status: string; note: string | null; createdAt: string }> }>('/api/admin/payout-requests'),
  adminUpdatePayoutRequestStatus: (id: number, status: string, note?: string) =>
    request<{ ok: boolean; id: number; status: string }>(`/api/admin/payout-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  adminUpdatePayoutStatus: (id: number, status: string) =>
    request<{ ok: boolean }>(`/api/admin/payouts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminTrainerRewards: (trainerId: string) =>
    request<{ rewards: Array<{ id: number; amountRub: number; status: string; planId: string; createdAt: string }>; summary: { total: number; available: number; paidOut: number } }>(`/api/admin/rewards/${encodeURIComponent(trainerId)}`),
  adminUserLookup: (q: string) =>
    request<{
      found: boolean;
      chatId?: string;
      userId?: string | null;
      profile?: { preferredName: string | null; telegramUsername: string | null; heightCm: number | null; currentWeightKg: number | null; goalType: string | null; dailyCaloriesKcal: number | null; createdAt: string };
      subscription?: { planId: string; status: string; currentPeriodEnd: string | null; trialEndsAt: string | null } | null;
      trainerProfile?: { fullName: string | null; verificationStatus: string; specialization: string | null; bio: string | null; appliedAt: string | null; verifiedAt: string | null } | null;
      asClient?: Array<{ trainerId: string; trainerName: string | null; connectedAt: string }>;
      asTrainer?: Array<{ clientId: string; clientAlias: string | null; connectedAt: string }>;
    }>(`/api/admin/user?q=${encodeURIComponent(q)}`),
  adminStats: () =>
    request<{
      users: { total: number; experts: number; companies: number; clients: number; newToday: number; newWeek: number; newMonth: number };
      experts: { total: number; newToday: number; newWeek: number; newMonth: number };
      subscriptions: { total: number; active: number; expired: number; neverPaid: number };
      payments: { total: number; today: number; week: number; month: number };
      paymentRevenue: { today: number; week: number; month: number };
      autoRenew: { on: number; off: number };
      plans: { free: number; optimal: number; pro: number };
      offerObligations: { day: { oneTime: number; lifetime: number }; week: { oneTime: number; lifetime: number }; month: { oneTime: number; lifetime: number } };
      aiCosts: { today: number | null; week: number | null; month: number | null; note: string };
    }>('/api/admin/stats'),
  adminAiCostAggregate: () =>
    request<{
      period: { start: string; end: string };
      totalCostUsd: number;
      totalTokens: number;
      totalRequests: number;
      byScenario: Array<{ scenario: string; requests: number; costUsd: number }>;
      byModel: Array<{ model: string; requests: number; costUsd: number }>;
    }>('/api/admin/ai-cost'),
  adminAiCostByUser: (userId: string) =>
    request<{
      userId: string | null;
      chatId: string | null;
      totalCostUsd: number;
      totalTokens: number;
      totalRequests: number;
      byScenario: Array<{ scenario: string; requests: number; costUsd: number }>;
      recent: Array<{ id: number; scenario: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; createdAt: string }>;
    }>(`/api/admin/ai-cost/user/${encodeURIComponent(userId)}`),
  adminGetSubscription: (chatId: string) =>
    request<{
      chatId: string;
      userId: string | null;
      legacySub: { planId: string; status: string; currentPeriodEnd: string | null; trialEndsAt: string | null; autoRenew: boolean; createdAt: string } | null;
      userSub:   { planId: string; status: string; currentPeriodEnd: string | null; trialEndsAt: string | null; autoRenew: boolean; createdAt: string } | null;
    }>(`/api/admin/subscriptions/${encodeURIComponent(chatId)}`),
  adminPatchSubscription: (chatId: string, action: string, days?: number, plan?: string) =>
    request<{ ok: boolean; chatId: string; userId: string | null }>(
      `/api/admin/subscriptions/${encodeURIComponent(chatId)}`,
      { method: 'PATCH', body: JSON.stringify({ action, days, plan }) },
    ),

  // ─── Trainer (expert) requisites ──────────────────────────────────────────
  trainerPayoutRequest: () =>
    request<{ request: { id: number; amountRub: number; status: string; requisitesSnapshot: Record<string, string>; rewardIds: number[]; createdAt: string } | null }>('/api/trainer/payout-request'),
  trainerCreatePayoutRequest: () =>
    request<{ ok: boolean; request: { id: number; amountRub: number; status: string; createdAt: string } }>('/api/trainer/payout-request', { method: 'POST' }),
  trainerRequisites: () =>
    request<{ requisites: Record<string, string> | null }>('/api/trainer/requisites'),
  trainerSaveRequisites: (requisites: Record<string, string>) =>
    request<{ ok: boolean }>('/api/trainer/requisites', { method: 'PATCH', body: JSON.stringify({ requisites }) }),
  trainerRecognizeRequisites: (imageData: string) =>
    request<{ recognized: Record<string, string> }>('/api/trainer/requisites/recognize', { method: 'POST', body: JSON.stringify({ imageData }) }),

  // ─── Admin: trainer requisites lookup ────────────────────────────────────
  adminTrainerRequisites: (chatId: string) =>
    request<{ fullName: string | null; specialization: string | null; requisites: Record<string, string> | null }>(`/api/admin/trainer-requisites/${encodeURIComponent(chatId)}`),

  // ─── Company requisites ────────────────────────────────────────────────────
  companyRequisites: () =>
    request<{ requisites: Record<string, string> | null }>('/api/company/requisites'),
  companySaveRequisites: (requisites: Record<string, string>) =>
    request<{ ok: boolean }>('/api/company/requisites', { method: 'PATCH', body: JSON.stringify({ requisites }) }),
  companyRecognizeRequisites: (imageData: string) =>
    request<{ recognized: Record<string, string> }>('/api/company/requisites/recognize', { method: 'POST', body: JSON.stringify({ imageData }) }),

  trainerOfferLinks: () =>
    request<{ totalUniqueUsers: number; offers: Array<{ offerId: string; offerKey: string; title: string; desc: string; emoji: string; link: string; invitedCount: number; earnedRub: number | null; users: Array<{ displayName: string | null; username: string | null; joinedAt: string }> }> }>('/api/referral/trainer-offers'),

  // ─── Expert acquisition referral ────────────────────────────────────────────
  expertReferralLink: () =>
    request<{
      referralCode: string;
      link: string;
      referrerType: 'expert' | 'company';
      model: { phase1Days: number; phase1Rate: number; phase2Rate: number; qualificationThreshold: number; description: string };
    }>('/api/expert-referral/link'),
  expertReferralRecruits: () =>
    request<{
      recruits: Array<{
        invitedExpertChatId: string;
        referrerType: string;
        attributedAt: string;
        phase1StartsAt: string;
        phase1EndsAt: string;
        isPhase1Complete: boolean;
        phase1ClientCount: number;
        isQualified: boolean;
        qualifiedAt: string | null;
        phase2ClientCount: number;
        phase1EarningsRub: number;
        phase2EarningsRub: number;
        totalEarningsRub: number;
      }>;
      totalRecruits: number;
      totalQualified: number;
      totalEarningsRub: number;
    }>('/api/expert-referral/recruits'),
  expertReferralMyAcquisition: () =>
    request<{
      acquisition: {
        phase1StartsAt: string;
        phase1EndsAt: string;
        isPhase1Complete: boolean;
        phase1ClientCount: number;
        isQualified: boolean;
        qualifiedAt: string | null;
        phase2ClientCount: number;
        phase1EarningsRub: number;
        phase2EarningsRub: number;
        totalEarningsRub: number;
        currentRate: number;
      } | null;
    }>('/api/expert-referral/my-acquisition'),

  // ─── Payments (YooKassa) ──────────────────────────────────────────────────
  createPayment: (planId: 'pro' | 'optimal', offer?: 'pro_3day' | 'month_1rub') =>
    request<{ confirmationUrl: string; paymentId: string }>(
      '/api/payments/create',
      { method: 'POST', body: JSON.stringify({ planId, offer }) },
    ),
  cancelAutoRenew: () =>
    request<{ ok: boolean; autoRenew: boolean }>(
      '/api/subscription/auto-renew',
      { method: 'PATCH', body: JSON.stringify({ enabled: false }) },
    ),

  // ─── Account linking (TG ↔ MAX cross-platform) ────────────────────────────
  accountLinkRequest: () =>
    request<{ code: string; expiresAt: string; ttlMinutes: number; instructions: string }>(
      '/api/account-link/request', { method: 'POST' },
    ),
  accountLinkPending: () =>
    request<{ pending: { code: string; expiresAt: string; initiatorPlatform: string } | null }>(
      '/api/account-link/pending',
    ),
  accountLinkConfirm: (code: string) =>
    request<{ ok: boolean; linkedPlatform: string; linkedPlatformId: string; message: string }>(
      '/api/account-link/confirm', { method: 'POST', body: JSON.stringify({ code }) },
    ),
  accountLinkCancel: () =>
    request<{ ok: boolean; canceled: number }>(
      '/api/account-link/request', { method: 'DELETE' },
    ),
};
