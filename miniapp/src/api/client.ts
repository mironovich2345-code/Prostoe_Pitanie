declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string } };
        ready(): void;
        expand(): void;
        close(): void;
        BackButton: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void; isVisible: boolean };
        MainButton: { text: string; show(): void; hide(): void; onClick(fn: () => void): void; isVisible: boolean };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
      };
    };
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData ?? '';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getTelegramInitData(),
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
  profile: () => request<{ profile: import('../types').UserProfile | null; weightHistory: Array<{ id: number; weightKg: number; createdAt: string }> }>('/api/profile'),
  reminders: () => request<{ reminders: import('../types').MealReminder[] }>('/api/reminders'),
  createReminder: (data: { mealType: string; time: string; enabled?: boolean }) =>
    request<{ reminder: import('../types').MealReminder }>('/api/reminders', { method: 'POST', body: JSON.stringify(data) }),
  patchReminder: (id: number, data: { time?: string; enabled?: boolean }) =>
    request<{ reminder: import('../types').MealReminder }>(`/api/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReminder: (id: number) =>
    request<{ ok: boolean }>(`/api/reminders/${id}`, { method: 'DELETE' }),
  patchProfileData: (data: { heightCm?: number; currentWeightKg?: number; desiredWeightKg?: number; sex?: string; birthDate?: string; activityLevel?: number; city?: string; timezone?: string; preferredName?: string }) =>
    request<{ ok: boolean; profile: import('../types').UserProfile | null }>('/api/profile/data', { method: 'PATCH', body: JSON.stringify(data) }),
  logWeight: (weightKg: number) =>
    request<{ ok: boolean; weightEntry: { id: number; weightKg: number; createdAt: string } }>('/api/profile/weight', { method: 'POST', body: JSON.stringify({ weightKg }) }),
  subscription: () => request<{ subscription: import('../types').SubscriptionInfo | null }>('/api/subscription'),
  trainerClients: () => request<{ clients: Array<{ link: unknown; profile: import('../types').UserProfile | null; subscription: import('../types').SubscriptionInfo | null }> }>('/api/trainer/clients'),
  trainerClientCard: (clientId: string) => request<{ link: unknown; profile: import('../types').UserProfile | null; subscription: import('../types').SubscriptionInfo | null }>(`/api/trainer/clients/${clientId}`),
  trainerClientStats: (clientId: string) => request<{ todayMeals: import('../types').MealEntry[]; todayCalories: number; recentMeals: import('../types').MealEntry[]; weightHistory: Array<{ weightKg: number; createdAt: string }>; profile: import('../types').UserProfile | null }>(`/api/trainer/clients/${clientId}/stats`),
  trainerAlerts: () => request<{ notLoggedToday: string[]; expiringSoon: unknown[]; totalClients: number; activeToday: number }>('/api/trainer/alerts'),
  trainerRewards: () => request<{ rewards: unknown[]; summary: { total: number; available: number; paidOut: number } }>('/api/trainer/rewards'),
  expertApply: (data: { fullName: string; socialLink: string; documentLink: string; specialization?: string; bio?: string }) =>
    request<{ trainerProfile: import('../types').TrainerProfileInfo }>('/api/expert/apply', { method: 'POST', body: JSON.stringify(data) }),
  disconnectTrainer: () => request<{ ok: boolean }>('/api/client/trainer', { method: 'DELETE' }),
  setTrainerHistoryAccess: (fullAccess: boolean) =>
    request<{ ok: boolean; fullHistoryAccess: boolean }>('/api/client/trainer/history-access', { method: 'PATCH', body: JSON.stringify({ fullAccess }) }),
};
