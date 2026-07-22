import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useWishlistQuery = (userId?: string) => {
  return useQuery({
    queryKey: ['wishlist', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('saved_items')
        .select(`
          item_id,
          items:item_id (
            id,
            title,
            price_per_day,
            category,
            location,
            owner:owner_id (
              is_verified,
              verification_level
            ),
            images:item_images (
              image_url
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((saved: { item_id: string; items: { id: string; title: string; price_per_day: number; category: string; location: string; owner: { is_verified: boolean; verification_level: string | null }; images: { image_url: string }[] } }) => ({
        id: saved.items.id,
        title: saved.items.title,
        image: saved.items.images?.[0]?.image_url || '/placeholder.svg',
        pricePerDay: Number(saved.items.price_per_day),
        category: saved.items.category,
        location: saved.items.location,
        rating: 0,
        reviewCount: 0,
        verificationLevel: saved.items.owner?.verification_level,
      }));
    },
    enabled: !!userId,
  });
};

export const useToggleWishlistMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, itemId, isSaved }: { userId: string; itemId: string; isSaved: boolean }) => {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_items')
          .delete()
          .eq('user_id', userId)
          .eq('item_id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_items')
          .insert({ user_id: userId, item_id: itemId });
        if (error) throw error;
      }
    },
    onMutate: async ({ userId, itemId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist', userId] });
      const previousWishlist = queryClient.getQueryData(['wishlist', userId]);

      queryClient.setQueryData(['wishlist', userId], (old: { id: string }[]) => {
        if (isSaved) {
          return old?.filter(item => item.id !== itemId) || [];
        }
        return old;
      });

      return { previousWishlist };
    },
    onError: (_err, { userId }, context) => {
      queryClient.setQueryData(['wishlist', userId], context?.previousWishlist);
    },
    onSettled: (_data, _error, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', userId] });
    },
  });
};
