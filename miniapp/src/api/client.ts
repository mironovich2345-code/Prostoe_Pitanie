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
  patchNotifications: (data: { notificationsEnabled?: boolean; notificationCount?: number; notificationTimes?: string }) =>
    request<{ ok: boolean }>('/api/profile/notifications', { method: 'PATCH', body: JSON.stringify(data) }),
  subscription: () => request<{ subscription: import('../types').SubscriptionInfo | null }>('/api/subscription'),
  trainerClients: () => request<{ clients: Array<{ link: unknown; profile: import('../types').UserProfile | null; subscription: import('../types').SubscriptionInfo | null }> }>('/api/trainer/clients'),
  trainerClientCard: (clientId: string) => request<{ link: unknown; profile: import('../types').UserProfile | null; subscription: import('../types').SubscriptionInfo | null }>(`/api/trainer/clients/${clientId}`),
  trainerClientStats: (clientId: string) => request<{ todayMeals: import('../types').MealEntry[]; todayCalories: number; recentMeals: import('../types').MealEntry[]; weightHistory: Array<{ weightKg: number; createdAt: string }>; profile: import('../types').UserProfile | null }>(`/api/trainer/clients/${clientId}/stats`),
  trainerAlerts: () => request<{ notLoggedToday: string[]; expiringSoon: unknown[]; totalClients: number; activeToday: number }>('/api/trainer/alerts'),
  trainerRewards: () => request<{ rewards: unknown[]; summary: { total: number; available: number; paidOut: number } }>('/api/trainer/rewards'),
  disconnectTrainer: () => request<{ ok: boolean }>('/api/client/trainer', { method: 'DELETE' }),
  setTrainerHistoryAccess: (fullAccess: boolean) =>
    request<{ ok: boolean; fullHistoryAccess: boolean }>('/api/client/trainer/history-access', { method: 'PATCH', body: JSON.stringify({ fullAccess }) }),
};
