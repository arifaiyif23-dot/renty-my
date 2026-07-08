import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAdminCheck(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin-check', userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase.functions.invoke('verify-admin');
      return !error && data?.isAdmin === true;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
