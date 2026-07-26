import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, isError, error, refetch } = useWishlistQuery(user?.id);
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

    queryClient.setQueryData(['wishlist', user?.id], (old: { id: string }[]) =>
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
        userId: user?.id || '',
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
          <div className="flex justify-center py-3">
            <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg" style={{ transform: `rotate(${pullDistance * 2}deg)`, opacity: Math.min(pullDistance / 80, 1) }}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Heart className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Wishlist</h1>
            <p className="text-sm text-muted-foreground">{items.length} saved items</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <EnhancedEmptyState
            icon={RefreshCw}
            title="Failed to load wishlist"
            description={error instanceof Error ? error.message : 'An error occurred while loading your wishlist. Please try again.'}
            actionLabel="Try Again"
            onAction={() => refetch()}
            showRetry
            onRetry={() => refetch()}
          />
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

interface WishlistItem {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category: string;
  location: string;
  rating: number;
  reviewCount: number;
  verificationLevel: string | null;
}

function SwipeableWishlistItem({ item, onDelete, isMobile }: { item: WishlistItem; onDelete: () => void; isMobile: boolean }) {
  const {
    swipeDistance,
    isDeleting,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeToDelete({ onDelete, threshold: 120 });

  if (!isMobile) {
    return <ListingCard {...item} />;
  }

  return (
    <div
      className="relative overflow-hidden transition-all duration-200 rounded-2xl"
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
        <ListingCard {...item} />
      </div>

      {swipeDistance > 0 && (
        <div
          className="absolute right-0 top-0 h-full flex items-center justify-center px-6 bg-destructive text-destructive-foreground rounded-2xl"
          style={{ width: `${swipeDistance}px` }}
        >
          <Trash2 className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}
