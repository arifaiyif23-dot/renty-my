import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useProfileStatsQuery = (userId?: string) => {
  return useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: async () => {
      if (!userId) return null;

      const [itemsResult, renterResult, ownerResult, reviewsResult] = await Promise.all([
        supabase.from("items").select("id", { count: "exact" }).eq("owner_id", userId),
        supabase.from("rentals").select("id", { count: "exact" }).eq("renter_id", userId),
        supabase.from("rentals").select("id", { count: "exact" }).eq("owner_id", userId),
        supabase.from("reviews").select("rating").eq("reviewee_id", userId),
      ]);

      const avgRating = reviewsResult.data && reviewsResult.data.length > 0
        ? reviewsResult.data.reduce((sum, r) => sum + r.rating, 0) / reviewsResult.data.length
        : 0;

      return {
        itemsListed: itemsResult.count || 0,
        rentalsAsRenter: renterResult.count || 0,
        rentalsAsOwner: ownerResult.count || 0,
        averageRating: avgRating,
        totalReviews: reviewsResult.data?.length || 0,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useVerificationStatusQuery = (userId?: string) => {
  return useQuery({
    queryKey: ['verification-status', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('verification_requests')
        .select('status, created_at, overall_confidence_score, rejection_reason')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};
