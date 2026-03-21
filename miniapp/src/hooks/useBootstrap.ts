import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: api.bootstrap,
    staleTime: 60_000,
    retry: 2,
  });
}
