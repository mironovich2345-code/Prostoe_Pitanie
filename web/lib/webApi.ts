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
};
