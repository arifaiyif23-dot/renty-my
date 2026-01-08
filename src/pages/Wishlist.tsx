import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import ItemCard from "@/components/ItemCard";
import SkeletonCard from "@/components/SkeletonCard";
import EnhancedEmptyState from "@/components/EnhancedEmptyState";
import SEO from "@/components/SEO";
import { Heart, Trash2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSwipeToDelete } from "@/hooks/use-swipe-to-delete";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useWishlistQuery, useToggleWishlistMutation } from "@/hooks/use-items-query";
import { useQueryClient } from "@tanstack/react-query";

export default function Wishlist() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, refetch } = useWishlistQuery(user?.id);
  const removeItemMutation = useToggleWishlistMutation();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await refetch();
    toast.success('Wishlist refreshed');
  }, isMobile);

  const removeFromWishlist = async (itemId: string) => {
    const previousItems = [...items];
    
    // Optimistic update via query cache
    queryClient.setQueryData(['wishlist', user?.id], (old: any[]) => 
      old?.filter(item => item.id !== itemId) || []
    );
    
    const undoToast = toast.success('Removed from wishlist', {
      action: {
        label: 'Undo',
        onClick: () => {
          queryClient.setQueryData(['wishlist', user?.id], previousItems);
          toast.dismiss(undoToast);
        },
      },
      duration: 5000,
    });

    try {
      await removeItemMutation.mutateAsync({
        userId: user!.id,
        itemId,
        isSaved: true,
      });
    } catch (error) {
      queryClient.setQueryData(['wishlist', user?.id], previousItems);
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
        
        {isLoading ? (
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
          <EnhancedEmptyState
            icon={Heart}
            title="No Saved Items Yet"
            description="Save items you love to easily find them later. Tap the heart icon on any listing to add it here."
            actionLabel="Browse Items"
            onAction={() => navigate('/search')}
            secondaryActionLabel="Explore Categories"
            onSecondaryAction={() => navigate('/')}
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
