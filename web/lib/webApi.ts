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
};
