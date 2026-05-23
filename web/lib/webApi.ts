// Web-specific API client for cookie-based session (web auth + expert applications).
// All calls go to /api/* which is proxied by Next.js to the Express backend,
// so cookies work same-origin regardless of actual deployment domain.

export interface WebUser {
  id: string;
  chatId?: string;
  platform: 'telegram';
}

export interface ExpertApplication {
  id: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  fullName: string;
  specialization: string;
  city: string | null;
  workFormat: string | null;
  experienceYears: number | null;
  socialLink: string | null;
  bio: string;
  proofLink: string | null;
  adminComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertProfile {
  id: number;
  fullName: string | null;
  specialization: string | null;
  bio: string | null;
  socialLink: string | null;
  city: string | null;
  experienceYears: number | null;
  suitableFor: string | null;
  tags: string | null;
  publicStatus: string;
  slug: string | null;
  referralCode: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
}

export interface UpdateExpertProfileData {
  fullName?: string;
  specialization?: string;
  bio?: string;
  city?: string;
  socialLink?: string;
  experienceYears?: number | null;
  suitableFor?: string;
  tags?: string;
}

export interface SubmitApplicationData {
  fullName: string;
  specialization: string;
  city?: string;
  workFormat?: string;
  experienceYears?: number;
  socialLink?: string;
  bio: string;
  proofLink?: string;
}

export interface ClientExpertRequest {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  expert: {
    id: number;
    fullName: string | null;
    specialization: string | null;
    slug: string | null;
    city: string | null;
    publicStatus: string;
  } | null;
}

export interface ExpertClientRequest {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  client: {
    displayName: string;
    telegramUsername: string | null;
  };
}

// ─── GET /api/web/me — full identity/state snapshot ───────────────────────────

export interface WebMeIdentity {
  platform: string;
  platformId: string;
  username: string | null;
  firstName: string | null;
}

export interface WebMeProfile {
  preferredName:     string | null;
  currentWeightKg:   number | null;
  desiredWeightKg:   number | null;
  heightCm:          number | null;
  goalType:          string | null;
  dailyCaloriesKcal: number | null;
  dailyProteinG:     number | null;
  dailyFatG:         number | null;
  dailyCarbsG:       number | null;
  city:              string | null;
  sex:               string | null;
  birthDate:         string | null;  // ISO string (e.g. "2000-01-15T00:00:00.000Z")
  activityLevel:     number | null;
}

export interface WebMeSubscription {
  planId: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  accessLevel: 'basic' | 'full';
  hasOptimal: boolean;
  hasPro: boolean;
}

export interface WebMeRoles {
  isClient: boolean;
  isExpert: boolean;
  isCompany: boolean;
  isAdmin: boolean;
}

export interface WebMeExpertState {
  exists: boolean;
  status: string | null;
  publicStatus: string | null;
  slug: string | null;
  referralCode: string | null;
  fullName: string | null;
  specialization: string | null;
  city: string | null;
}

export interface WebMeCompanyState {
  exists: boolean;
  status: string | null;
  publicStatus: string | null;
  slug: string | null;
  referralCode: string | null;
  name: string | null;
  city: string | null;
}

export interface WebMeApplicationState {
  exists: boolean;
  status: string | null;
  adminComment: string | null;
  createdAt: string | null;
}

export interface WebMeClientExpertState {
  hasExpert: boolean;
  expert: {
    id: number;
    fullName: string | null;
    specialization: string | null;
    slug: string | null;
    city: string | null;
    publicStatus: string;
  } | null;
  pendingRequest: {
    id: string;
    status: string;
    createdAt: string;
    expert: {
      id: number;
      fullName: string | null;
      slug: string | null;
    } | null;
  } | null;
}

export interface WebMeAuth {
  currentMethod: 'telegram' | 'max' | 'phone' | null;
  identities: {
    telegram: { connected: boolean; username: string | null; platformId: string | null };
    max: { connected: boolean; username: string | null; platformId: string | null };
    phone: { connected: boolean; phoneMasked: string | null };
  };
}

export interface WebMeResponse {
  ok: boolean;
  user: { id: string; createdAt: string };
  identity: WebMeIdentity | null;
  profile: WebMeProfile | null;
  subscription: WebMeSubscription;
  roles: WebMeRoles;
  expert: WebMeExpertState;
  company: WebMeCompanyState;
  expertApplication: WebMeApplicationState;
  clientExpert: WebMeClientExpertState;
  auth: WebMeAuth;
}

export interface PhoneCodeRequestResponse { ok: boolean }
export interface PhoneCodeVerifyResponse  { ok: boolean; userId: string }

export interface PhoneLinkRequestResponse { ok: boolean; alreadyLinked?: boolean }
export interface PhoneLinkVerifyResponse  { ok: boolean; alreadyLinked?: boolean }

export interface WebClientProfileUpdatePayload {
  preferredName?:  string | null;
  city?:           string | null;
  sex?:            string;
  birthDate?:      string;        // YYYY-MM-DD
  activityLevel?:  number;
  heightCm?:       number;
  currentWeightKg?: number;
  desiredWeightKg?: number;
  goalType?:       string;
}

// ─── Expert cabinet — client list & card ─────────────────────────────────────

export type WebExpertAccessStatus = 'active_pro' | 'wrong_tariff' | 'unpaid' | 'unknown';

export interface WebExpertClientSubscription {
  planId: string;
  status: string;
  accessLevel: 'full' | 'basic';
  currentPeriodEnd: string | null;
}

export interface WebExpertClientSummary {
  linkId: string;
  clientUserId: string | null;
  displayName: string;
  username: string | null;
  city: string | null;
  goalType: string | null;
  currentWeightKg: number | null;
  desiredWeightKg: number | null;
  dailyCaloriesKcal: number | null;
  subscription: WebExpertClientSubscription | null;
  accessStatus: WebExpertAccessStatus;
  connectedAt: string;
}

export interface WebExpertClientDetail {
  linkId: string;
  userId: string | null;
  displayName: string;
  username: string | null;
  city: string | null;
  goalType: string | null;
  currentWeightKg: number | null;
  desiredWeightKg: number | null;
  heightCm: number | null;
  dailyCaloriesKcal: number | null;
  dailyProteinG: number | null;
  dailyFatG: number | null;
  dailyCarbsG: number | null;
  subscription: WebExpertClientSubscription | null;
  accessStatus: WebExpertAccessStatus;
  connectedAt: string;
}

export interface WebExpertClientsResponse {
  clients: WebExpertClientSummary[];
}

export interface WebExpertClientResponse {
  ok: boolean;
  client: WebExpertClientDetail;
}

// ─── Company cabinet ──────────────────────────────────────────────────────────

export interface WebCompanyProfile {
  id: string;
  name: string | null;
  city: string | null;
  bio: string | null;
  socialLink: string | null;
  contactPerson: null;
  status: string;
  publicStatus: string;
  slug: string | null;
  referralCode: string | null;
  createdAt: string;
}

export interface WebCompanyProfileResponse {
  ok: boolean;
  company: WebCompanyProfile;
}

export interface WebCompanyProfileUpdatePayload {
  name?: string;
  city?: string | null;
  bio?: string | null;
  socialLink?: string | null;
}

export interface WebCompanyOffer {
  key: string;
  offerType: string;
  title: string;
  description: string;
  link: string;
}

export interface WebCompanyOffersResponse {
  ok: boolean;
  offers: WebCompanyOffer[];
  expertAcquisitionLink: string | null;
}

export interface WebCompanyStats {
  referralCode: string | null;
  totalReferredUsers: number;
  payingUsers: number | null;
  activeSubscriptions: number | null;
  expertRecruits: number;
  rewardsTotal: number;
  pendingRewards: number;
}

export interface WebCompanyStatsResponse {
  ok: boolean;
  stats: WebCompanyStats;
}

// ─── Web subscription & payments ─────────────────────────────────────────────

export interface WebSubscriptionInfo {
  planId: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  accessLevel: 'basic' | 'full';
  hasOptimal: boolean;
  hasPro: boolean;
}

export interface WebSubscriptionOffers {
  canUseProIntro: boolean;
  proIntro: {
    enabled: boolean;
    priceRub: number;
    durationDays: number;
    thenPriceRub: number;
  };
}

export interface WebSubscriptionResponse {
  ok: boolean;
  subscription: WebSubscriptionInfo;
  offers: WebSubscriptionOffers;
}

export interface WebPaymentCreatePayload {
  planId: 'optimal' | 'pro' | 'pro_intro';
  acceptedSubscriptionTerms: true;
  returnUrl?: string;
  receiptEmail?: string;
}

export interface WebPaymentCreateResponse {
  ok: boolean;
  payment: { id: string; confirmationUrl: string };
}

// ─── Web Nutrition Diary ──────────────────────────────────────────────────────

export interface WebMealEntry {
  id: number;
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  createdAt: string;
}

export interface WebNutritionDayResponse {
  ok: boolean;
  date: string;
  meals: WebMealEntry[];
  totals: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
  };
  target: {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
  } | null;
}

export interface WebAddMealPayload {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  caloriesKcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  fiberG?: number;
}

export interface WebAddMealResponse {
  ok: boolean;
  meal: WebMealEntry;
}

// ─── Web Weight History ───────────────────────────────────────────────────────

export interface WebWeightEntry {
  id: number;
  weightKg: number;
  measuredAt: string;
  createdAt: string;
}

export interface WebWeightProfile {
  currentWeightKg: number | null;
  desiredWeightKg: number | null;
  heightCm: number | null;
  goalType: string | null;
}

export interface WebWeightProgress {
  startWeightKg: number;
  currentWeightKg: number;
  desiredWeightKg: number;
  totalDeltaKg: number;
  doneDeltaKg: number;
  progressPercent: number;
}

export interface WebWeightResponse {
  ok: boolean;
  profile: WebWeightProfile | null;
  entries: WebWeightEntry[];
  progress: WebWeightProgress | null;
}

export interface WebAddWeightPayload {
  weightKg: number;
  measuredAt?: string;  // YYYY-MM-DD
}

export interface WebAddWeightResponse {
  ok: boolean;
  entry: WebWeightEntry;
}

// ─── Web AI Food Analysis ─────────────────────────────────────────────────────

export interface WebAnalyzeFoodTextPayload {
  text: string;
  date?: string;  // YYYY-MM-DD (passed through, not used in analysis)
}

export interface WebAiFoodAnalysis {
  name: string;
  mealType: string;
  items: string[];
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  weightG: number | null;
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  clarificationQuestion: string | null;
}

export interface WebAnalyzeFoodTextResponse {
  ok: boolean;
  analysis: WebAiFoodAnalysis;
}

export interface WebAddAiAnalysisMealPayload {
  date?: string;
  sourceType?: 'web_ai_text' | 'web_ai_photo';
  analysis: {
    name: string;
    mealType: string;
    caloriesKcal?: number | null;
    proteinG?: number | null;
    fatG?: number | null;
    carbsG?: number | null;
    fiberG?: number | null;
    weightG?: number | null;
    items?: string[];
    confidence?: string;
    needsClarification?: boolean;
  };
}

export interface WebAnalyzeFoodPhotoPayload {
  imageDataUrl: string;
  date?: string;
}

export interface WebAnalyzeFoodPhotoResponse {
  ok: boolean;
  analysis: WebAiFoodAnalysis;
}

// ─── Web Product Search ───────────────────────────────────────────────────────

export interface WebProductSearchResult {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  packageWeightG: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  confidence: string;
  isVerified: boolean;
}

export interface WebProductSearchResponse {
  items: WebProductSearchResult[];
}

export interface WebAddProductMealPayload {
  productId: string;
  grams: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  date?: string;  // YYYY-MM-DD
}

export interface WebProductBarcodeResponse {
  ok: boolean;
  product: WebProductSearchResult;
}

// ─── Web Nutrition Week Stats ─────────────────────────────────────────────────

export interface WebNutritionStatsTotals {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface WebNutritionStatsDay {
  date: string;
  totals: WebNutritionStatsTotals;
  mealCount: number;
  calorieStatus: 'no_data' | 'no_target' | 'under' | 'ok' | 'over';
}

export interface WebWeeklyInsight {
  bannerTitle: string;
  bannerText: string;
  severity: 'neutral' | 'good' | 'warning';
  nextMealSuggestion: string;
  mealAdvice: string[];
}

export interface WebWeeklyInsightResponse {
  ok: boolean;
  insight: WebWeeklyInsight;
}

export interface WebNutritionWeekStatsResponse {
  ok: boolean;
  period: { startDate: string; endDate: string };
  target: {
    dailyCaloriesKcal: number | null;
    dailyProteinG: number | null;
    dailyFatG: number | null;
    dailyCarbsG: number | null;
  } | null;
  days: WebNutritionStatsDay[];
  averages: WebNutritionStatsTotals;
  summary: {
    daysWithData: number;
    daysUnderTarget: number;
    daysOk: number;
    daysOverTarget: number;
  };
}

// ─── Admin cabinet ────────────────────────────────────────────────────────────

export interface WebAdminOverview {
  usersTotal: number;
  expertsTotal: number;
  companiesTotal: number;
  expertApplicationsPending: number;
  clientExpertRequestsPending: number;
  activeSubscriptions: number;
  paymentsTotal: number | null;
}

export interface WebAdminUserIdentity {
  platform: string;
  platformId: string;
  username: string | null;
  firstName: string | null;
}

export interface WebAdminUserSummary {
  id: string;
  identities: WebAdminUserIdentity[];
  profile: { preferredName: string | null; city: string | null; goalType: string | null } | null;
  subscription: { planId: string; status: string; currentPeriodEnd: string | null } | null;
  roles: { isExpert: boolean; isCompany: boolean };
}

export interface WebAdminUserDetail {
  id: string;
  createdAt: string;
  identities: (WebAdminUserIdentity & { linkedAt: string })[];
  profile: {
    preferredName: string | null;
    city: string | null;
    goalType: string | null;
    currentWeightKg: number | null;
    desiredWeightKg: number | null;
    heightCm: number | null;
    dailyCaloriesKcal: number | null;
    dailyProteinG: number | null;
    dailyFatG: number | null;
    dailyCarbsG: number | null;
    referralCode: string | null;
    referredByRole: string | null;
    profileCreatedAt: string;
  } | null;
  subscription: {
    planId: string;
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    gracePeriodEnd: string | null;
    autoRenew: boolean;
    createdAt: string;
  } | null;
  roles: { isExpert: boolean; isCompany: boolean; isAdmin: boolean };
  expert: {
    id: number;
    fullName: string | null;
    specialization: string | null;
    city: string | null;
    publicStatus: string;
    slug: string | null;
    referralCode: string | null;
    verificationStatus: string;
    verifiedAt: string | null;
    createdAt: string;
  } | null;
  activeExpertLink: { trainerId: number; trainerUserId: string | null; connectedAt: string } | null;
  recentPayments: { id: string; planId: string; amountRub: number; status: string; createdAt: string }[];
}

export interface WebAdminExpert {
  id: number;
  userId: string | null;
  chatId: string;
  fullName: string | null;
  city: string | null;
  specialization: string | null;
  verificationStatus: string;
  publicStatus: string;
  slug: string | null;
  referralCode: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface WebAdminApplication {
  id: string;
  userId: string;
  status: string;
  fullName: string;
  specialization: string;
  city: string | null;
  workFormat: string | null;
  experienceYears: number | null;
  socialLink: string | null;
  bio: string;
  proofLink: string | null;
  adminComment: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebAdminRequest {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  respondedAt: string | null;
  client: { userId: string; displayName: string | null; username: string | null };
  expert: { id: number; fullName: string | null; specialization: string | null; slug: string | null };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (!res.ok) {
    // Try to read a structured error code from the JSON body.
    // If the body isn't JSON (HTML error page, empty 502, etc.),
    // fall back to API_ERROR_<status> so the caller can see the HTTP status.
    let code = `API_ERROR_${res.status}`;
    try {
      const body = await res.json() as Record<string, unknown>;
      const bodyCode = body.error ?? body.code ?? body.message;
      if (typeof bodyCode === 'string' && bodyCode) code = bodyCode;
    } catch {
      // non-JSON body — keep the API_ERROR_<status> fallback
    }
    console.debug('[webApi] error', res.status, code, path);
    throw new ApiError(res.status, code, `${path}: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const webApi = {
  getMe: () =>
    request<{ user: WebUser }>('/api/web-auth/me'),

  getMeData: () =>
    request<WebMeResponse>('/api/web/me'),

  telegramLogin: (data: Record<string, string | number>) =>
    request<{ user: WebUser }>('/api/web-auth/telegram', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/web-auth/logout', { method: 'POST' }),

  getMyApplication: () =>
    request<{ application: ExpertApplication | null }>('/api/expert-applications/me'),

  submitApplication: (data: SubmitApplicationData) =>
    request<{ application: ExpertApplication }>('/api/expert-applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getExpertProfile: () =>
    request<{ profile: ExpertProfile }>('/api/web/expert/profile'),

  updateExpertProfile: (data: UpdateExpertProfileData) =>
    request<{ profile: ExpertProfile }>('/api/web/expert/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  publishExpertProfile: () =>
    request<{ ok: boolean; publicStatus: string; slug?: string }>('/api/web/expert/profile/publish', { method: 'POST' }),

  hideExpertProfile: () =>
    request<{ ok: boolean; publicStatus: string }>('/api/web/expert/profile/hide', { method: 'POST' }),

  // ─── Client → Expert requests ───────────────────────────────────────────────

  getWebSubscriptionStatus: () =>
    request<{ hasPro: boolean }>('/api/client-expert-requests/subscription-status'),

  createClientExpertRequest: (trainerSlug: string, message?: string) =>
    request<{ request: ClientExpertRequest }>('/api/client-expert-requests', {
      method: 'POST',
      body: JSON.stringify({ trainerSlug, message }),
    }),

  getMyClientExpertRequests: () =>
    request<{ requests: ClientExpertRequest[] }>('/api/client-expert-requests/me'),

  // ─── Expert incoming requests ────────────────────────────────────────────────

  getExpertClientRequests: () =>
    request<{ requests: ExpertClientRequest[] }>('/api/web/expert/client-requests'),

  acceptExpertClientRequest: (id: string) =>
    request<{ ok: boolean; status: string }>(`/api/web/expert/client-requests/${encodeURIComponent(id)}/accept`, { method: 'POST' }),

  rejectExpertClientRequest: (id: string) =>
    request<{ ok: boolean; status: string }>(`/api/web/expert/client-requests/${encodeURIComponent(id)}/reject`, { method: 'POST' }),

  // ─── Web client profile ──────────────────────────────────────────────────────

  updateClientProfile: (payload: WebClientProfileUpdatePayload) =>
    request<{ ok: boolean; profile: Partial<WebMeProfile> }>('/api/web/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // ─── Phone / SMS OTP login ───────────────────────────────────────────────────

  requestPhoneCode: (phone: string) =>
    request<PhoneCodeRequestResponse>('/api/web-auth/phone/request-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyPhoneCode: (phone: string, code: string) =>
    request<PhoneCodeVerifyResponse>('/api/web-auth/phone/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  // ─── Phone-link (attach phone to an already-authenticated account) ───────────

  requestPhoneLinkCode: (phone: string) =>
    request<PhoneLinkRequestResponse>('/api/web-auth/phone/link/request-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyPhoneLinkCode: (phone: string, code: string) =>
    request<PhoneLinkVerifyResponse>('/api/web-auth/phone/link/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  // ─── Expert cabinet — client list & card ──────────────────────────────────

  getExpertClients: () =>
    request<WebExpertClientsResponse>('/api/web/expert/clients'),

  getExpertClient: (linkId: string) =>
    request<WebExpertClientResponse>(`/api/web/expert/clients/${encodeURIComponent(linkId)}`),

  // ─── Company cabinet ───────────────────────────────────────────────────────

  getCompanyProfile: () =>
    request<WebCompanyProfileResponse>('/api/web/company/profile'),

  updateCompanyProfile: (payload: WebCompanyProfileUpdatePayload) =>
    request<WebCompanyProfileResponse>('/api/web/company/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getCompanyOffers: () =>
    request<WebCompanyOffersResponse>('/api/web/company/offers'),

  getCompanyStats: () =>
    request<WebCompanyStatsResponse>('/api/web/company/stats'),

  // ─── Web subscription & payments ───────────────────────────────────────────

  getWebSubscription: () =>
    request<WebSubscriptionResponse>('/api/web/subscription'),

  createWebPayment: (payload: WebPaymentCreatePayload) =>
    request<WebPaymentCreateResponse>('/api/web/payments/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Web Nutrition Diary ────────────────────────────────────────────────────

  getNutritionDay: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<WebNutritionDayResponse>(`/api/web/nutrition/day${qs}`);
  },

  addMeal: (payload: WebAddMealPayload) =>
    request<WebAddMealResponse>('/api/web/nutrition/meals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMeal: (id: number) =>
    request<{ ok: boolean }>(`/api/web/nutrition/meals/${id}`, { method: 'DELETE' }),

  // ─── Web Weight History ─────────────────────────────────────────────────────

  getWeightHistory: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return request<WebWeightResponse>(`/api/web/weight${qs}`);
  },

  addWeightEntry: (payload: WebAddWeightPayload) =>
    request<WebAddWeightResponse>('/api/web/weight', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteWeightEntry: (id: number) =>
    request<{ ok: boolean }>(`/api/web/weight/${id}`, { method: 'DELETE' }),

  // ─── Web AI Food Analysis ───────────────────────────────────────────────────

  analyzeFoodText: (payload: WebAnalyzeFoodTextPayload) =>
    request<WebAnalyzeFoodTextResponse>('/api/web/nutrition/analyze-text', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addAiAnalysisMeal: (payload: WebAddAiAnalysisMealPayload) =>
    request<WebAddMealResponse>('/api/web/nutrition/add-ai-analysis', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  analyzeFoodPhoto: (payload: WebAnalyzeFoodPhotoPayload) =>
    request<WebAnalyzeFoodPhotoResponse>('/api/web/nutrition/analyze-photo', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Web Product Search ─────────────────────────────────────────────────────

  searchWebProducts: (q: string, limit?: number) => {
    const params = new URLSearchParams({ q });
    if (limit) params.set('limit', String(limit));
    return request<WebProductSearchResponse>(`/api/web/products/search?${params}`);
  },

  addProductMeal: (payload: WebAddProductMealPayload) =>
    request<WebAddMealResponse>('/api/web/nutrition/add-product', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProductByBarcode: (barcode: string) =>
    request<WebProductBarcodeResponse>(`/api/web/products/barcode/${encodeURIComponent(barcode)}`),

  getNutritionWeekStats: (endDate?: string) => {
    const qs = endDate ? `?endDate=${encodeURIComponent(endDate)}` : '';
    return request<WebNutritionWeekStatsResponse>(`/api/web/nutrition/stats/week${qs}`);
  },

  getWeeklyNutritionInsight: (endDate?: string) =>
    request<WebWeeklyInsightResponse>('/api/web/nutrition/insight/week', {
      method: 'POST',
      body: JSON.stringify({ endDate }),
    }),

  // ─── Admin cabinet ─────────────────────────────────────────────────────────

  getAdminOverview: () =>
    request<{ ok: boolean; overview: WebAdminOverview }>('/api/web/admin/overview'),

  getAdminUsers: (q?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return request<{ ok: boolean; users: WebAdminUserSummary[] }>(`/api/web/admin/users${qs ? `?${qs}` : ''}`);
  },

  getAdminUser: (userId: string) =>
    request<{ ok: boolean; user: WebAdminUserDetail }>(`/api/web/admin/users/${encodeURIComponent(userId)}`),

  adminSubscriptionAction: (userId: string, action: 'activate' | 'cancel' | 'expire', planId?: string, days?: number) =>
    request<{ ok: boolean; subscription: { planId: string; status: string; currentPeriodEnd: string | null } }>(
      `/api/web/admin/users/${encodeURIComponent(userId)}/subscription`,
      { method: 'POST', body: JSON.stringify({ action, planId, days }) },
    ),

  getAdminExperts: (q?: string, status?: string, type?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return request<{ ok: boolean; experts: WebAdminExpert[] }>(`/api/web/admin/experts${qs ? `?${qs}` : ''}`);
  },

  patchAdminExpert: (id: number, data: Partial<{ fullName: string; city: string; bio: string; socialLink: string; publicStatus: string; verificationStatus: string }>) =>
    request<{ ok: boolean; expert: WebAdminExpert }>(`/api/web/admin/experts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAdminApplications: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<{ ok: boolean; applications: WebAdminApplication[] }>(`/api/web/admin/expert-applications${qs}`);
  },

  approveAdminApplication: (id: string) =>
    request<{ ok: boolean; status: string }>(`/api/web/admin/expert-applications/${encodeURIComponent(id)}/approve`, { method: 'POST' }),

  rejectAdminApplication: (id: string, adminComment?: string) =>
    request<{ ok: boolean; status: string }>(`/api/web/admin/expert-applications/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ adminComment }),
    }),

  getAdminRequests: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<{ ok: boolean; requests: WebAdminRequest[] }>(`/api/web/admin/client-expert-requests${qs}`);
  },
};
