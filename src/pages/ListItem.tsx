import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { validateUserInput } from '@/utils/sanitize';
import { detectBannedContent, ModerationResult } from '@/utils/contentModeration';
import { VerificationRequiredBanner } from '@/components/VerificationRequiredBanner';
import { ContentModerationFeedback } from '@/components/ContentModerationFeedback';
import { useDebounce } from '@/hooks/use-debounce';

export default function ListItem() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [moderationResult, setModerationResult] = useState<ModerationResult | null>(null);
  
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'electronics' as ItemCategory,
    price_per_day: '',
    location: profile?.location || '',
  });

  // Debounced values for real-time content moderation
  const debouncedTitle = useDebounce(formData.title, 500);
  const debouncedDescription = useDebounce(formData.description, 500);

  // Real-time content moderation check
  useEffect(() => {
    if (debouncedTitle || debouncedDescription) {
      const result = detectBannedContent(debouncedTitle, debouncedDescription);
      setModerationResult(result);
    } else {
      setModerationResult(null);
    }
  }, [debouncedTitle, debouncedDescription]);

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

    // Check if user is verified
    if (!profile?.is_verified) {
      toast.error('Verification required to list items', {
        description: 'Please complete ID verification to start listing',
        action: {
          label: 'Verify Now',
          onClick: () => navigate('/verification')
        }
      });
      return;
    }

    // Client-side content moderation check
    const contentCheck = detectBannedContent(formData.title, formData.description);
    if (contentCheck.isBlocked) {
      toast.error('Listing blocked', {
        description: contentCheck.reason,
      });
      setModerationResult(contentCheck);
      return;
    }

    setIsLoading(true);
    
    try {
      // Server-side content validation
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-listing-content',
        {
          body: { title: formData.title, description: formData.description }
        }
      );

      if (validationError) {
        console.error('Validation error:', validationError);
        // Continue with submission if validation service fails (fallback to client-side)
      } else if (validationData && !validationData.isValid) {
        toast.error('Listing blocked', {
          description: validationData.reason || 'Content not allowed',
        });
        setIsLoading(false);
        return;
      }

      // Validate and sanitize all user inputs
      const sanitizedTitle = validateUserInput(formData.title, 200);
      const sanitizedDescription = validateUserInput(formData.description, 5000);
      const sanitizedLocation = validateUserInput(formData.location, 200);

      const { data, error } = await supabase
        .from('items')
        .insert({
          owner_id: user.id,
          title: sanitizedTitle,
          description: sanitizedDescription,
          category: formData.category,
          price_per_day: parseFloat(formData.price_per_day),
          location: sanitizedLocation,
          latitude: profile?.latitude,
          longitude: profile?.longitude,
        })
        .select()
        .single();

      if (error) {
        // Handle verification error from database
        if (error.message?.includes('violates row-level security policy') || 
            error.message?.includes('is_verified')) {
          toast.error('Verification required to list items', {
            description: 'Please complete ID verification to start listing',
            action: {
              label: 'Verify Now',
              onClick: () => navigate('/verification')
            }
          });
          return;
        }
        throw error;
      }

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

        {/* Verification Status Banner */}
        <VerificationRequiredBanner isVerified={profile?.is_verified ?? false} />
        
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

              {/* Real-time Content Moderation Feedback */}
              <ContentModerationFeedback result={moderationResult} />

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
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium" 
                  disabled={isLoading || moderationResult?.isBlocked || !profile?.is_verified}
                >
                  {isLoading ? 'Listing...' : moderationResult?.isBlocked ? 'Content Blocked' : 'List Item'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
