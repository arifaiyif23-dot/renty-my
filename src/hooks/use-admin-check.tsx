import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types';

export function useAdminCheck(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin-check', userId],
    queryFn: async ({ signal }) => {
      if (!userId) return { isAdmin: false, role: null as AppRole | null };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const onAbort = () => { clearTimeout(timeoutId); controller.abort(); };
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const { data, error } = await supabase.functions.invoke('verify-admin', {
          signal: controller.signal,
        });
        if (error || !data?.isAdmin) return { isAdmin: false, role: null as AppRole | null };
        return { isAdmin: true, role: data.role as AppRole };
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}
