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
import { toast } from 'sonner';
import { ItemCategory } from '@/types';
import { ImageUpload } from '@/components/ImageUpload';
import { PageLayout } from "@/components/PageLayout";
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
            status: 'created',
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
      <PageLayout variant="narrow">
          <div className="card-base rounded-lg p-6 mt-6">
            <p className="text-center mb-4">Please sign in to list an item</p>
            <Button onClick={() => navigate('/auth')} className="w-full rounded-lg">
              Sign In
            </Button>
          </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="narrow">
        <div className="md:hidden mb-4 flex items-center gap-2">
          <BackButton fallbackPath="/" />
          <h1 className="text-xl font-bold">{t('listItem.title')}</h1>
        </div>

        <VerificationRequiredBanner isVerified={profile?.is_verified ?? false} />

        <div className="card-base rounded-lg p-6 md:mt-6">
          <div className="hidden md:block mb-6">
            <h1 className="text-2xl font-bold">{t('listItem.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('listItem.subtitle')}</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit('active'); }} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="item-images" className="text-sm font-medium">{t('listItem.itemImages')} *</Label>
                <ImageUpload onImagesChange={setImageUrls} maxImages={5} />
                <p className="text-xs text-muted-foreground">
                  {t('listItem.uploadHelper')}
                </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">{t('listItem.titleLabel')} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-12 text-base rounded-lg"
                placeholder={t('listItem.titlePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">{t('listItem.descriptionLabel')} *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[120px] text-base resize-none rounded-lg"
                placeholder={t('listItem.descriptionPlaceholder')}
                maxLength={1000}
                required
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.description.length} / 1000
              </p>
            </div>

            <ContentModerationFeedback result={moderationResult} />

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium">{t('listItem.categoryLabel')} *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as ItemCategory })}
              >
                <SelectTrigger id="category" className="h-12 text-base rounded-lg">
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
                <Label htmlFor="price" className="text-sm font-medium">{t('listItem.priceLabel')} *</Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={formData.price_per_day}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setFormData({ ...formData, price_per_day: v });
                  }}
                  className="h-12 text-base rounded-lg"
                  placeholder={t('listItem.pricePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_hour" className="text-sm font-medium">{t('listItem.priceHourLabel')}</Label>
                <Input
                  id="price_hour"
                  type="text"
                  inputMode="decimal"
                  value={formData.price_per_hour}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '');
                    setFormData({ ...formData, price_per_hour: v });
                  }}
                  className="h-12 text-base rounded-lg"
                  placeholder={t('listItem.priceHourPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit" className="text-sm font-medium">{t('listItem.depositLabel')}</Label>
              <Input
                id="deposit"
                type="text"
                inputMode="decimal"
                value={formData.deposit_amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  setFormData({ ...formData, deposit_amount: v });
                }}
                className="h-12 text-base rounded-lg"
                placeholder={t('listItem.depositPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('listItem.depositHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('listItem.paymentMethod')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_mode: 'escrow' })}
                  className={`h-16 rounded-lg border-2 text-left px-3 transition ${
                    formData.payment_mode === 'escrow'
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="font-semibold text-sm">{t('listItem.escrowLabel')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('listItem.escrowDesc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_mode: 'manual' })}
                  className={`h-16 rounded-lg border-2 text-left px-3 transition ${
                    formData.payment_mode === 'manual'
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="font-semibold text-sm">{t('listItem.manualLabel')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('listItem.manualDesc')}</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('listItem.itemCondition')}</Label>
                <Select
                  value={formData.item_condition}
                  onValueChange={(value) => setFormData({ ...formData, item_condition: value })}
                >
                  <SelectTrigger className="h-12 text-base rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t('listItem.conditionNew')}</SelectItem>
                    <SelectItem value="like_new">{t('listItem.conditionLikeNew')}</SelectItem>
                    <SelectItem value="good">{t('listItem.conditionGood')}</SelectItem>
                    <SelectItem value="fair">{t('listItem.conditionFair')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('listItem.cancellationPolicy')}</Label>
                <Select
                  value={formData.cancellation_policy}
                  onValueChange={(value) => setFormData({ ...formData, cancellation_policy: value })}
                >
                  <SelectTrigger className="h-12 text-base rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flexible">{t('listItem.cancellationFlexible')}</SelectItem>
                    <SelectItem value="moderate">{t('listItem.cancellationModerate')}</SelectItem>
                    <SelectItem value="strict">{t('listItem.cancellationStrict')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">{t('listItem.locationLabel')} *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="h-12 text-base rounded-lg"
                placeholder={t('listItem.locationPlaceholder')}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('listItem.instantBooking')}</Label>
                <p className="text-xs text-muted-foreground">{t('listItem.instantBookingDesc')}</p>
              </div>
              <Switch
                checked={formData.instant_book_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, instant_book_enabled: checked })}
              />
            </div>

            {formData.instant_book_enabled && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('listItem.autoApprove')}</Label>
                  <p className="text-xs text-muted-foreground">{t('listItem.autoApproveDesc')}</p>
                </div>
                <Switch
                  checked={formData.auto_approve_bookings}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_approve_bookings: checked })}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('listItem.specifications')}</Label>
              {categorySpecLabels[formData.category].map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <Input
                    value={formData.specifications[field.key] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      specifications: { ...formData.specifications, [field.key]: e.target.value }
                    })}
                    className="h-9 text-sm rounded-lg"
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>

            <div className="sticky bottom-mobile-nav left-0 right-0 bg-background border-t pt-4 -mx-6 px-6 pb-2 md:relative md:border-0 md:p-0 md:pt-2">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 text-base rounded-lg"
                  disabled={isLoading}
                  onClick={() => handleSubmit('draft')}
                >
                  {isLoading ? t('common.loading') : t('listItem.saveDraft')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 text-base font-medium rounded-lg"
                  disabled={isLoading || moderationResult?.isBlocked}
                >
                  {isLoading ? t('common.loading') : moderationResult?.isBlocked ? t('listItem.contentBlocked') : t('listItem.publish')}
                </Button>
              </div>
            </div>
          </form>
        </div>
    </PageLayout>
  );
}
