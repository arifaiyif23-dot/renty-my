import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Item, ItemCategory } from '@/types';
import ItemCard from '@/components/ItemCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search as SearchIcon } from 'lucide-react';

export default function Search() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    fetchItems();
  }, [searchQuery, category, minPrice, maxPrice]);

  const fetchItems = async () => {
    try {
      let query = supabase
        .from('items')
        .select(`
          *,
          owner:profiles(*),
          images:item_images(*)
        `)
        .eq('is_available', true);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (minPrice) {
        query = query.gte('price_per_day', parseFloat(minPrice));
      }

      if (maxPrice) {
        query = query.lte('price_per_day', parseFloat(maxPrice));
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Search Items</h1>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div>
          <Select value={category} onValueChange={(value) => setCategory(value as ItemCategory | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="vehicles">Vehicles</SelectItem>
              <SelectItem value="tools">Tools</SelectItem>
              <SelectItem value="sports">Sports</SelectItem>
              <SelectItem value="party">Party</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Min RM"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Max RM"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No items found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              image={item.images?.[0]?.image_url || '/placeholder.svg'}
              pricePerDay={item.price_per_day}
              category={item.category}
              rating={4.5}
              reviewCount={0}
              location={item.location}
            />
          ))}
        </div>
      )}
    </div>
  );
}
