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

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    let code = 'API_ERROR';
    try { code = (await res.json()).error ?? code; } catch { /* ignore */ }
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

export { ApiError };
