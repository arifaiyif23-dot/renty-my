import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSuspensionCheck } from '@/hooks/use-suspension-check';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassCard } from '@/components/ui/GlassCard';
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
import { Switch } from '@/components/ui/switch';
import { categorySpecLabels } from '@/components/SpecificationsSection';

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
    price_per_hour: '',
    deposit_amount: '',
    payment_mode: 'escrow' as 'escrow' | 'manual',
    location: profile?.location || '',
    instant_book_enabled: false,
    auto_approve_bookings: false,
    specifications: {} as Record<string, string>,
    item_condition: 'good',
    cancellation_policy: 'flexible',
  });

  const debouncedTitle = useDebounce(formData.title, 500);
  const debouncedDescription = useDebounce(formData.description, 500);

  useEffect(() => {
    if (debouncedTitle || debouncedDescription) {
      const result = detectBannedContent(debouncedTitle, debouncedDescription);
      setModerationResult(result);
    } else {
      setModerationResult(null);
    }
  }, [debouncedTitle, debouncedDescription]);

  const { checkNotSuspended } = useSuspensionCheck();

  const handleSubmit = async (listingStatus: 'active' | 'draft') => {
    if (!user) {
      toast.error('Please sign in to list an item');
      navigate('/auth');
      return;
    }

    if (!checkNotSuspended('create a listing')) return;

    if (imageUrls.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }

    const pricePerDay = parseFloat(formData.price_per_day);
    if (!formData.price_per_day || isNaN(pricePerDay) || pricePerDay < 1) {
      toast.error('Please enter a valid price per day');
      return;
    }

    const pricePerHour = formData.price_per_hour ? parseFloat(formData.price_per_hour) : null;
    if (pricePerHour !== null && (isNaN(pricePerHour) || pricePerHour < 0)) {
      toast.error('Please enter a valid hourly price');
      return;
    }

    const depositAmount = formData.deposit_amount ? parseFloat(formData.deposit_amount) : 0;
    if (formData.deposit_amount && (isNaN(depositAmount) || depositAmount < 0)) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    if (listingStatus === 'active' && !profile?.is_verified) {
      toast.error('Verification required to list items', {
        description: 'Please complete ID verification to start listing',
        action: {
          label: 'Verify Now',
          onClick: () => navigate('/verification')
        }
      });
      return;
    }

    if (listingStatus === 'draft') {
      setIsLoading(true);
      try {
        const sanitizedTitle = validateUserInput(formData.title, 200);
        const sanitizedDescription = validateUserInput(formData.description, 5000);
        const sanitizedLocation = validateUserInput(formData.location, 200);

        const specs = Object.fromEntries(
          Object.entries(formData.specifications).filter(([, v]) => v.trim())
        );
        const { data, error } = await supabase
          .from('items')
          .insert({
            owner_id: user.id,
            title: sanitizedTitle,
            description: sanitizedDescription,
            category: formData.category,
            price_per_day: pricePerDay,
            price_per_hour: pricePerHour,
            deposit_amount: depositAmount,
            payment_mode: formData.payment_mode,
            location: sanitizedLocation,
            latitude: profile?.latitude,
            longitude: profile?.longitude,
            listing_status: 'draft',
            is_available: false,
            tags: [],
            instant_book_enabled: formData.instant_book_enabled,
            auto_approve_bookings: formData.auto_approve_bookings,
            specifications: specs,
            item_condition: formData.item_condition,
            cancellation_policy: formData.cancellation_policy,
          })
          .select()
          .single();

        if (error) throw error;

        const imageInserts = imageUrls.map((url, index) => ({
          item_id: data.id,
          image_url: url,
          is_primary: index === 0,
          display_order: index,
        }));

        if (imageInserts.length > 0) {
          const { error: imageError } = await supabase.from('item_images').insert(imageInserts);
          if (imageError) throw imageError;
        }

        toast.success('Draft saved!');
        navigate(`/items/${data.id}`);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
      return;
    }

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
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-listing-content',
        {
          body: { title: formData.title, description: formData.description }
        }
      );

      if (validationError) {
        console.error('Validation error:', validationError);
        toast.error('Content validation unavailable. Please try again.');
        setIsLoading(false);
        return;
      }

      if (validationData && !validationData.isValid) {
        toast.error('Listing blocked', {
          description: validationData.reason || 'Content not allowed',
        });
        setIsLoading(false);
        return;
      }

      const sanitizedTitle = validateUserInput(formData.title, 200);
      const sanitizedDescription = validateUserInput(formData.description, 5000);
      const sanitizedLocation = validateUserInput(formData.location, 200);

      const specs = Object.fromEntries(
        Object.entries(formData.specifications).filter(([, v]) => v.trim())
      );
      const { data, error } = await supabase
        .from('items')
        .insert({
          owner_id: user.id,
          title: sanitizedTitle,
          description: sanitizedDescription,
          category: formData.category,
          price_per_day: pricePerDay,
          price_per_hour: pricePerHour,
          deposit_amount: depositAmount,
          payment_mode: formData.payment_mode,
          location: sanitizedLocation,
          latitude: profile?.latitude,
          longitude: profile?.longitude,
          listing_status: 'active',
          tags: [],
          instant_book_enabled: formData.instant_book_enabled,
          auto_approve_bookings: formData.auto_approve_bookings,
          specifications: specs,
          item_condition: formData.item_condition,
          cancellation_policy: formData.cancellation_policy,
        })
        .select()
        .single();

      if (error) {
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
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
          <GlassCard padding="lg">
            <p className="text-center mb-4">Please sign in to list an item</p>
            <Button onClick={() => navigate('/auth')} className="w-full rounded-xl">
              Sign In
            </Button>
          </GlassCard>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-2xl pb-mobile-nav">
        <div className="md:hidden mb-4 flex items-center gap-2">
          <BackButton fallbackPath="/" />
          <h1 className="text-xl font-bold">List Your Item</h1>
        </div>

        <VerificationRequiredBanner isVerified={profile?.is_verified ?? false} />

        <GlassCard padding="lg" className="md:mt-6">
          <div className="hidden md:block mb-6">
            <h1 className="text-2xl font-bold">List Your Item</h1>
            <p className="text-muted-foreground text-sm mt-1">Share your item with the community and start earning</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit('active'); }} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="item-images" className="text-sm font-medium">Item Images *</Label>
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
                className="h-12 text-base rounded-xl"
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
                className="min-h-[120px] text-base resize-none rounded-xl"
                placeholder="Describe your item in detail..."
                maxLength={1000}
                required
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.description.length} / 1000
              </p>
            </div>

            <ContentModerationFeedback result={moderationResult} />

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as ItemCategory })}
              >
                <SelectTrigger id="category" className="h-12 text-base rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                  <SelectItem value="tools">Tools</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-medium">Harga / Hari (RM) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_day}
                  onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                  className="h-12 text-base rounded-xl"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_hour" className="text-sm font-medium">Harga / Jam (RM)</Label>
                <Input
                  id="price_hour"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_hour}
                  onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })}
                  className="h-12 text-base rounded-xl"
                  placeholder="Opsyenal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit" className="text-sm font-medium">Deposit (RM)</Label>
              <Input
                id="deposit"
                type="number"
                step="0.01"
                min="0"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                className="h-12 text-base rounded-xl"
                placeholder="0.00 (opsyenal)"
              />
              <p className="text-xs text-muted-foreground">
                Deposit dipulangkan selepas barang dikembalikan dalam keadaan baik.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Kaedah Bayaran</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_mode: 'escrow' })}
                  className={`h-16 rounded-xl border-2 text-left px-3 transition ${
                    formData.payment_mode === 'escrow'
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="font-semibold text-sm">Escrow (auto)</div>
                  <div className="text-[11px] text-muted-foreground">Platform tahan bayaran</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_mode: 'manual' })}
                  className={`h-16 rounded-xl border-2 text-left px-3 transition ${
                    formData.payment_mode === 'manual'
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="font-semibold text-sm">Manual (bank)</div>
                  <div className="text-[11px] text-muted-foreground">Bayar terus ke akaun</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Item Condition</Label>
                <Select
                  value={formData.item_condition}
                  onValueChange={(value) => setFormData({ ...formData, item_condition: value })}
                >
                  <SelectTrigger className="h-12 text-base rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like_new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cancellation Policy</Label>
                <Select
                  value={formData.cancellation_policy}
                  onValueChange={(value) => setFormData({ ...formData, cancellation_policy: value })}
                >
                  <SelectTrigger className="h-12 text-base rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flexible">Free cancellation</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="h-12 text-base rounded-xl"
                placeholder="City, State"
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Instant Booking</Label>
                <p className="text-xs text-muted-foreground">Allow renters to book instantly without waiting for approval</p>
              </div>
              <Switch
                checked={formData.instant_book_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, instant_book_enabled: checked })}
              />
            </div>

            {formData.instant_book_enabled && (
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-approve Bookings</Label>
                  <p className="text-xs text-muted-foreground">Automatically approve all incoming booking requests</p>
                </div>
                <Switch
                  checked={formData.auto_approve_bookings}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_approve_bookings: checked })}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium">Specifications</Label>
              {categorySpecLabels[formData.category].map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <Input
                    value={formData.specifications[field.key] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      specifications: { ...formData.specifications, [field.key]: e.target.value }
                    })}
                    className="h-9 text-sm rounded-xl"
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>

            <div className="sticky bottom-16 md:bottom-0 left-0 right-0 bg-background border-t pt-4 -mx-6 px-6 pb-2 md:relative md:border-0 md:p-0 md:pt-2">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 text-base rounded-xl"
                  disabled={isLoading}
                  onClick={() => handleSubmit('draft')}
                >
                  {isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 text-base font-medium rounded-xl"
                  disabled={isLoading || moderationResult?.isBlocked}
                >
                  {isLoading ? 'Publishing...' : moderationResult?.isBlocked ? 'Content Blocked' : 'Publish'}
                </Button>
              </div>
            </div>
          </form>
        </GlassCard>
      </div>
    </>
  );
}
