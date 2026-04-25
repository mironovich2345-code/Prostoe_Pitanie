import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useBootstrap(enabled = true) {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: async () => {
      const t = performance.now();
      console.info(`[perf] T4 bootstrap request ${t.toFixed(0)}ms`);
      const data = await api.bootstrap();
      console.info(`[perf] T5 bootstrap response +${(performance.now() - t).toFixed(0)}ms RTT`);
      return data;
    },
    staleTime: 60_000,
    retry: 1,          // 1 retry instead of 2 — faster error display; user has a Reload button
    networkMode: 'always', // don't suppress in WebView even if navigator.onLine is unreliable
    enabled,
  });
}
