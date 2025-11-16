import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Item, ItemCategory } from '@/types';

interface FetchItemsParams {
  searchQuery?: string;
  category?: ItemCategory | 'all';
  minPrice?: string;
  maxPrice?: string;
  userLocation?: string;
  verifiedOnly?: boolean;
  instantBookOnly?: boolean;
  itemCondition?: string;
  sortBy?: 'newest' | 'price_low' | 'price_high';
}

export const useItemsQuery = (params: FetchItemsParams) => {
  return useQuery({
    queryKey: ['items', params],
    queryFn: async () => {
      let query = supabase
        .from('items')
        .select(`
          *,
          owner:profiles(*),
          images:item_images(*)
        `)
        .eq('is_available', true);

      if (params.searchQuery) {
        query = query.or(`title.ilike.%${params.searchQuery}%,description.ilike.%${params.searchQuery}%`);
      }

      if (params.category && params.category !== 'all') {
        query = query.eq('category', params.category);
      }

      if (params.minPrice) {
        query = query.gte('price_per_day', parseFloat(params.minPrice));
      }

      if (params.maxPrice) {
        query = query.lte('price_per_day', parseFloat(params.maxPrice));
      }

      if (params.userLocation) {
        query = query.ilike('location', `%${params.userLocation}%`);
      }

      if (params.verifiedOnly) {
        query = query.eq('owner.is_verified', true);
      }

      if (params.instantBookOnly) {
        query = query.eq('instant_book_enabled', true);
      }

      if (params.itemCondition && params.itemCondition !== 'all') {
        query = query.eq('item_condition', params.itemCondition);
      }

      // Sorting
      if (params.sortBy === 'price_low') {
        query = query.order('price_per_day', { ascending: true });
      } else if (params.sortBy === 'price_high') {
        query = query.order('price_per_day', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes for search results
  });
};

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
              is_verified
            ),
            images:item_images (
              image_url
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((saved: any) => ({
        id: saved.items.id,
        title: saved.items.title,
        image: saved.items.images?.[0]?.image_url || '/placeholder.svg',
        pricePerDay: Number(saved.items.price_per_day),
        category: saved.items.category,
        location: saved.items.location,
        rating: 0,
        reviewCount: 0,
        isOwnerVerified: saved.items.owner?.is_verified || false,
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

      queryClient.setQueryData(['wishlist', userId], (old: any[]) => {
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
