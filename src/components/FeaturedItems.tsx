import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EnhancedItemCard } from "./EnhancedItemCard";
import SkeletonCard from "./SkeletonCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

export const FeaturedItems = () => {
  const navigate = useNavigate();
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);

    try {
      // Combine all 3 queries using Promise.all for better performance
      const [featuredResult, trendingResult, newArrivalsResult] = await Promise.all([
        supabase
          .from("items")
          .select(`
            *,
            owner:profiles!items_owner_id_fkey(id, full_name, avatar_url, is_verified),
            item_images(image_url, is_primary, display_order)
          `)
          .eq("is_available", true)
          .eq("featured", true)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("items")
          .select(`
            *,
            owner:profiles!items_owner_id_fkey(id, full_name, avatar_url, is_verified),
            item_images(image_url, is_primary, display_order)
          `)
          .eq("is_available", true)
          .order("view_count", { ascending: false })
          .limit(6),
        supabase
          .from("items")
          .select(`
            *,
            owner:profiles!items_owner_id_fkey(id, full_name, avatar_url, is_verified),
            item_images(image_url, is_primary, display_order)
          `)
          .eq("is_available", true)
          .order("created_at", { ascending: false })
          .limit(6)
      ]);

      setFeaturedItems(featuredResult.data || []);
      setTrendingItems(trendingResult.data || []);
      setNewItems(newArrivalsResult.data || []);
    } catch (error) {
      console.error('Error fetching featured items:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="featured" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="new">New Arrivals</TabsTrigger>
        </TabsList>

        <TabsContent value="featured" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredItems.length > 0 ? (
              featuredItems.map((item) => {
                const primaryImage = item.item_images?.find((img: any) => img.is_primary) || item.item_images?.[0];
                return (
                  <EnhancedItemCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    image={primaryImage?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80'}
                    pricePerDay={Number(item.price_per_day)}
                    category={item.category}
                    rating={0}
                    reviewCount={0}
                    location={item.location}
                    isOwnerVerified={item.owner?.is_verified}
                  />
                );
              })
            ) : (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No featured items at the moment
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trending" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingItems.length > 0 ? (
              trendingItems.map((item) => {
                const primaryImage = item.item_images?.find((img: any) => img.is_primary) || item.item_images?.[0];
                return (
                  <EnhancedItemCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    image={primaryImage?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80'}
                    pricePerDay={Number(item.price_per_day)}
                    category={item.category}
                    rating={0}
                    reviewCount={0}
                    location={item.location}
                    isOwnerVerified={item.owner?.is_verified}
                  />
                );
              })
            ) : (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No trending items yet
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newItems.length > 0 ? (
              newItems.map((item) => {
                const primaryImage = item.item_images?.find((img: any) => img.is_primary) || item.item_images?.[0];
                return (
                  <EnhancedItemCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    image={primaryImage?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80'}
                    pricePerDay={Number(item.price_per_day)}
                    category={item.category}
                    rating={0}
                    reviewCount={0}
                    location={item.location}
                    isOwnerVerified={item.owner?.is_verified}
                  />
                );
              })
            ) : (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No new items available
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
