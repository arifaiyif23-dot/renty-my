import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Item } from '@/types';
import { EnhancedItemCard } from './EnhancedItemCard';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function RecentlyViewed() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentlyViewed();
  }, [user]);

  const fetchRecentlyViewed = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_views')
        .select(`
          item_id,
          viewed_at,
          item:items(
            *,
            owner:profiles(*),
            images:item_images(*)
          )
        `)
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      // Extract unique items
      const uniqueItems = new Map();
      data?.forEach((view: any) => {
        if (view.item && !uniqueItems.has(view.item.id)) {
          uniqueItems.set(view.item.id, view.item);
        }
      });

      setItems(Array.from(uniqueItems.values()));
    } catch (error) {
      console.error('Error fetching recently viewed:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_views')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setItems([]);
      toast.success('Viewing history cleared');
    } catch (error) {
      toast.error('Failed to clear history');
    }
  };

  if (!user || loading || items.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-2">
              Recently Viewed
            </h2>
            <p className="text-muted-foreground">Items you've checked out recently</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <EnhancedItemCard 
              key={item.id} 
              id={item.id}
              title={item.title}
              description={item.description}
              image={item.images?.[0]?.image_url || '/placeholder.svg'}
              pricePerDay={Number(item.price_per_day)}
              category={item.category}
              location={item.location}
              owner={item.owner}
              images={item.images}
              {...item}
            />
          ))}
        </div>
      </div>
    </section>
  );
}