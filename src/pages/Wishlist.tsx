import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import ItemCard from "@/components/ItemCard";
import SkeletonCard from "@/components/SkeletonCard";
import EmptyState from "@/components/EmptyState";
import SEO from "@/components/SEO";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

  return (
    <>
      <SEO
        title="My Wishlist"
        description="View your saved items and favorites"
      />
      <Header />
      <div className="container mx-auto p-4 pb-mobile-nav">
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
              <ItemCard key={item.id} {...item} />
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
