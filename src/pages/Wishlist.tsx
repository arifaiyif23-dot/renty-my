import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import ItemCard from "@/components/ItemCard";
import SkeletonCard from "@/components/SkeletonCard";
import EmptyState from "@/components/EmptyState";
import SEO from "@/components/SEO";
import { Heart, Trash2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export default function Wishlist() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSavedItems();
    } else {
      navigate('/auth');
    }
  }, [user]);

  const isMobile = useIsMobile();

  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await fetchSavedItems();
    toast.success('Wishlist refreshed');
  }, isMobile);

  const fetchSavedItems = async () => {
    try {
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
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedItems = (data || []).map((saved: any) => ({
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

      setItems(formattedItems);
    } catch (error) {
      console.error('Error fetching saved items:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (itemId: string) => {
    const previousItems = [...items];
    
    // Optimistic update
    setItems(prev => prev.filter(item => item.id !== itemId));
    
    const undoToast = toast.success('Removed from wishlist', {
      action: {
        label: 'Undo',
        onClick: () => {
          setItems(previousItems);
          toast.dismiss(undoToast);
        },
      },
      duration: 5000,
    });

    try {
      const { error } = await supabase
        .from('saved_items')
        .delete()
        .eq('user_id', user?.id)
        .eq('item_id', itemId);

      if (error) throw error;
    } catch (error) {
      // Rollback on error
      setItems(previousItems);
      toast.dismiss(undoToast);
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  return (
    <>
      <SEO
        title="My Wishlist"
        description="View your saved items and favorites"
      />
      <Header />
      <div className="container mx-auto p-4 pb-mobile-nav">
        {pullDistance > 0 && (
          <div className="flex justify-center py-2">
            <RefreshCw className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
          </div>
        )}
        <h1 className="text-3xl font-bold mb-6 text-foreground">My Wishlist</h1>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {items.map((item) => (
              <SwipeableWishlistItem
                key={item.id}
                item={item}
                onDelete={() => removeFromWishlist(item.id)}
                isMobile={isMobile}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title="No Saved Items"
            description="Start adding items to your wishlist to see them here"
            actionLabel="Browse Items"
            onAction={() => navigate('/search')}
          />
        )}
      </div>
    </>
  );
}

function SwipeableWishlistItem({ item, onDelete, isMobile }: { item: any; onDelete: () => void; isMobile: boolean }) {
  const {
    swipeDistance,
    isDeleting,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeToDelete({ onDelete, threshold: 120 });

  if (!isMobile) {
    return <ItemCard {...item} />;
  }

  return (
    <div
      className="relative overflow-hidden transition-all duration-200"
      style={{ 
        transform: `translateX(-${swipeDistance}px)`,
        opacity: isDeleting ? 0 : 1 
      }}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative"
      >
        <ItemCard {...item} />
      </div>
      
      {swipeDistance > 0 && (
        <div
          className="absolute right-0 top-0 h-full flex items-center justify-center px-6 bg-destructive text-destructive-foreground"
          style={{ width: `${swipeDistance}px` }}
        >
          <Trash2 className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}
