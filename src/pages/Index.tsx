import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import { AnimatedCategoryIcon } from "@/components/AnimatedCategoryIcon";
import { EnhancedItemCard } from "@/components/EnhancedItemCard";
import SkeletonCard from "@/components/SkeletonCard";
import EnhancedEmptyState from "@/components/EnhancedEmptyState";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Package, Car, Smartphone, Dumbbell, Music, Wrench, Shirt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedItem {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category: string;
  rating: number;
  reviewCount: number;
  location: string;
  isOwnerVerified?: boolean;
}

interface Category {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  minPrice?: number;
}

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useKeyboardShortcuts();
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalItemCount, setTotalItemCount] = useState<number>(0);

  const categoryConfig = useMemo(() => ({
    electronics: { icon: Smartphone, displayName: "Electronics" },
    vehicles:    { icon: Car,        displayName: "Vehicles" },
    tools:       { icon: Wrench,     displayName: "Tools" },
    sports:      { icon: Dumbbell,   displayName: "Sports" },
    party:       { icon: Music,      displayName: "Party" },
    fashion:     { icon: Shirt,      displayName: "Fashion" },
    other:       { icon: Package,    displayName: "Other" },
  }), []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [itemsResult, categoryResult, countResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            id, title, price_per_day, category, location, created_at, owner_id,
            item_images!inner(image_url),
            profiles!items_owner_id_fkey(is_verified)
          `)
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('items').select('category, price_per_day').eq('is_available', true),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_available', true),
      ]);

      if (countResult.count !== null) setTotalItemCount(countResult.count);
      if (itemsResult.error) throw itemsResult.error;

      const itemsData = itemsResult.data;
      const itemIds = itemsData?.map(i => i.id) || [];
      const { data: allReviews } = await supabase
        .from('rentals')
        .select('item_id, reviews(rating)')
        .in('item_id', itemIds);

      const reviewsByItem = new Map<string, number[]>();
      allReviews?.forEach((rental: any) => {
        if (rental.reviews?.length) {
          const existing = reviewsByItem.get(rental.item_id) || [];
          reviewsByItem.set(rental.item_id, [...existing, ...rental.reviews.map((r: any) => r.rating)]);
        }
      });

      const itemsWithReviews = (itemsData || []).map((item) => {
        const ratings = reviewsByItem.get(item.id) || [];
        const reviewCount = ratings.length;
        const rating = reviewCount > 0 ? ratings.reduce((s, r) => s + r, 0) / reviewCount : 0;
        return {
          id: item.id,
          title: item.title,
          image: (item.item_images ?? [])[0]?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80',
          pricePerDay: Number(item.price_per_day),
          category: item.category,
          rating: Math.round(rating * 10) / 10,
          reviewCount,
          location: item.location,
          isOwnerVerified: item.profiles?.is_verified || false,
        };
      });
      setFeaturedItems(itemsWithReviews);

      if (categoryResult.error) throw categoryResult.error;
      const categoryMap = new Map<string, { count: number; minPrice: number }>();
      (categoryResult.data || []).forEach((it) => {
        const existing = categoryMap.get(it.category);
        const price = Number(it.price_per_day);
        if (existing) {
          existing.count++;
          existing.minPrice = Math.min(existing.minPrice, price);
        } else {
          categoryMap.set(it.category, { count: 1, minPrice: price });
        }
      });
      const categoryData: Category[] = Array.from(categoryMap.entries()).map(([name, data]) => {
        const config = categoryConfig[name.toLowerCase()] || { icon: Package, displayName: name };
        return {
          name: config.displayName,
          icon: config.icon,
          count: data.count,
          minPrice: Math.round(data.minPrice),
        };
      });
      setCategories(categoryData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-mobile-nav">
      <SEO
        title="Renty — Rent Anything in Malaysia"
        description={`Trusted peer-to-peer rentals. ${totalItemCount || 'Hundreds of'} verified items from cameras to cars. Request, approve, pick up.`}
      />
      <Header />

      {/* Search-first hero — one intent, one CTA */}
      <section className="px-4 pt-6 pb-8 md:pt-10 md:pb-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-center">Rent anything, from people nearby.</h1>
          <p className="mb-6 text-center text-muted-foreground">
            {totalItemCount > 0 ? `${totalItemCount}+ verified items` : 'Verified owners'} across Malaysia.
          </p>
          <SearchBar />
        </div>
      </section>

      {/* Categories */}
      {(categories.length > 0 || loading) && (
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4">Browse categories</h2>
            {categories.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                {categories.map((category) => (
                  <AnimatedCategoryIcon
                    key={category.name}
                    icon={category.icon}
                    name={category.name}
                    count={category.count}
                    minPrice={category.minPrice}
                    onClick={() => navigate(`/search?category=${category.name.toLowerCase()}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="surface-1 rounded-lg p-4 text-center animate-pulse">
                    <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted" />
                    <div className="mx-auto h-3 w-2/3 rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Featured / newest */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-end justify-between">
            <h2>Newest listings</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
              View all
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : featuredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredItems.map((item) => <EnhancedItemCard key={item.id} {...item} />)}
            </div>
          ) : (
            <EnhancedEmptyState
              icon={Package}
              title="No listings yet"
              description="Be the first to list something for rent."
              actionLabel="List an item"
              onAction={() => navigate('/list-item')}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
