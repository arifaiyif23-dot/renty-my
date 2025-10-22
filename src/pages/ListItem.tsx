import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ItemCategory } from '@/types';
import { ImageUpload } from '@/components/ImageUpload';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';

export default function ListItem() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'electronics' as ItemCategory,
    price_per_day: '',
    location: profile?.location || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to list an item');
      navigate('/auth');
      return;
    }

    if (imageUrls.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .insert({
          owner_id: user.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          price_per_day: parseFloat(formData.price_per_day),
          location: formData.location,
          latitude: profile?.latitude,
          longitude: profile?.longitude,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert images into item_images table
      const imageInserts = imageUrls.map((url, index) => ({
        item_id: data.id,
        image_url: url,
        is_primary: index === 0,
        display_order: index,
      }));

      const { error: imageError } = await supabase
        .from('item_images')
        .insert(imageInserts);

      if (imageError) throw imageError;
      
      toast.success('Item listed successfully!');
      navigate(`/items/${data.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to list item');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center mb-4">Please sign in to list an item</p>
              <Button onClick={() => navigate('/auth')} className="w-full">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-2xl pb-mobile-nav">
        {/* Mobile Back Button */}
        <div className="md:hidden mb-4 flex items-center gap-2">
          <BackButton fallbackPath="/" />
          <h1 className="text-xl font-bold">List Your Item</h1>
        </div>
        
        <Card>
          <CardHeader className="hidden md:block">
            <CardTitle>List Your Item</CardTitle>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Item Images *</Label>
              <ImageUpload onImagesChange={setImageUrls} maxImages={5} />
              <p className="text-xs text-muted-foreground">
                Upload up to 5 images. First image will be the primary photo.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-12 text-base"
                placeholder="e.g., Canon EOS R5 Camera"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[120px] text-base resize-none"
                placeholder="Describe your item in detail..."
                required
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.description.length} / 1000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as ItemCategory })}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                  <SelectItem value="tools">Tools</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-medium">Price per Day (RM) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_per_day}
                onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                className="h-12 text-base"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="h-12 text-base"
                placeholder="City, State"
                required
              />
            </div>

            <div className="sticky bottom-0 left-0 right-0 bg-background border-t pt-4 -mx-6 px-6 pb-2 md:relative md:border-0 md:p-0 md:pt-2">
              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                {isLoading ? 'Listing...' : 'List Item'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
