import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Item } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapPin, Share2, MessageCircle, Loader2, ChevronDown, PackageX } from 'lucide-react';
import { isNative } from '@/lib/platform';
import type { DateRange } from 'react-day-picker';
import { PageLayout } from '@/components/PageLayout';
import BackButton from '@/components/BackButton';
import ImageCarousel from '@/components/ImageCarousel';
import { ListingCard } from '@/components/ListingCard';
import { VendorCard } from '@/components/marketplace/VendorCard';
import { SkeletonV2 } from '@/components/SkeletonV2';
import { addRecentlyViewed } from '@/hooks/use-recently-viewed';
import SEO from '@/components/SEO';
import { UnifiedCalendar } from '@/components/UnifiedCalendar';
import { SaveItemButton } from '@/components/SaveItemButton';
import StickyBookingBar from '@/components/StickyBookingBar';
import { TimePicker } from '@/components/TimePicker';
import { ReviewsList } from '@/components/ReviewsList';
import {
  computeRentalSubtotal,
  computeRentalTotal,
  discountPercentForHours,
  formatDuration,
  formatRentalPeriod,
  isSameDayReturnValid,
  rentalDays,
  rentalHours,
} from '@/lib/rentalTime';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ItemDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [similarItems, setSimilarItems] = useState<Array<{ id: string; title: string; price_per_day: number; category: string; location: string; images: { image_url: string }[]; rating?: number; reviewCount?: number; owner?: { verification_level?: string } }>>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const trackView = async () => {
      if (!id) return;
      try {
        if (user) {
          const { count } = await supabase
            .from('user_views')
            .select('id', { count: 'exact', head: true })
            .eq('item_id', id)
            .eq('user_id', user.id)
            .gte('viewed_at', new Date(Date.now() - 60000).toISOString());
          if (count && count > 0) return;
        }
        await supabase.from('user_views').insert({ user_id: user?.id || null, item_id: id });
        await supabase.rpc('increment_item_views', { item_id_param: id });
      } catch (e) { console.warn('trackView failed:', e); }
    };

    const fetchItem = async () => {
      if (!mountedRef.current) return;
      try {
        const { data, error } = await supabase
          .from('items')
          .select(`
            *,
            owner:profiles(id, full_name, avatar_url, is_verified, verification_level, trust_score, vendor_trust_score, response_rate, total_rentals_completed, created_at),
            images:item_images(*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        // Anonymous visitors can't read the profiles table (RLS: active item
        // owners only, authenticated users only), so the owner FK comes back
        // null. Fall back to the public_profiles view so the VendorCard still
        // renders for logged-out visitors — safe fields only, no PII.
        if (data && !data.owner) {
          const { data: publicOwner } = await supabase
            .from('public_profiles')
            .select('id, full_name, avatar_url, is_verified, verification_level, trust_score, location, created_at')
            .eq('id', data.owner_id)
            .maybeSingle();
          if (publicOwner) {
            data.owner = publicOwner as unknown as Item['owner'];
          }
        }

        setItem(data);

        if (user && data) {
          setLoadingRental(true);
          supabase
            .from('rentals')
            .select('*')
            .eq('item_id', data.id)
            .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
            .then(() => {
              if (mountedRef.current) { setLoadingRental(false); }
            })
            .catch(() => { if (mountedRef.current) setLoadingRental(false); });
        }

        addRecentlyViewed({
          id: data.id, title: data.title, image: data.images?.[0]?.image_url || '',
          pricePerDay: Number(data.price_per_day), category: data.category, location: data.location,
        });

        if (data) fetchSimilarItems(data.category, data.id);
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : t('itemDetail.anErrorOccurred'));
        toast.error(t('itemDetail.failedToLoadItem'));
      } finally { setLoading(false); }
    };

    if (id) {
      setLoadError(null);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) { setItem(null); setLoading(false); setLoadError(t('itemDetail.invalidItemId')); return; }
      fetchItem();
      trackView();
    }
  }, [id, user, t]);

  const fetchSimilarItems = async (category: string, currentItemId: string) => {
    if (!mountedRef.current) return;
    setLoadingSimilar(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`id, title, price_per_day, category, location, images:item_images(image_url), owner:owner_id(verification_level)`)
        .eq('category', category).eq('status', 'available').neq('id', currentItemId).limit(4);
      if (error) throw error;
      setSimilarItems((data || []).map(i => ({ ...i, rating: 0, reviewCount: 0 })));
    } catch { setSimilarItems([]); }
    finally { setLoadingSimilar(false); }
  };

  useEffect(() => {
    const pending = sessionStorage.getItem('renty_pending_booking');
    if (pending) {
      try {
        const booking = JSON.parse(pending);
        if (booking.itemId === id && booking.startDate) {
          setDateRange({ from: new Date(booking.startDate), to: booking.endDate ? new Date(booking.endDate) : undefined });
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('renty_pending_booking');
    }
  }, [id]);

  const scrollToBooking = () => {
    const el = document.getElementById('booking-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleBooking = async () => {
    if (isBooking) return;
    if (!user) {
      if (dateRange?.from && dateRange?.to) {
        sessionStorage.setItem('renty_pending_booking', JSON.stringify({ itemId: item?.id, startDate: dateRange.from.toISOString(), endDate: dateRange.to.toISOString() }));
      }
      toast.error(t('itemDetail.signInToBook'));
      navigate('/auth', { state: { redirectTo: `/items/${item?.id}` } });
      return;
    }
    if (!profile?.is_verified) {
      toast.error(t('itemDetail.verificationRequired'));
      navigate('/verification', { state: { redirectTo: `/items/${item?.id}` } });
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error(t('itemDetail.selectDatesError'));
      return;
    }
    if (!pickupTime || !returnTime) {
      toast.error(t('rentalTime.selectTimesError'));
      return;
    }
    if (!isSameDayReturnValid(
      dateRange.from.toISOString().split('T')[0],
      dateRange.to.toISOString().split('T')[0],
      pickupTime,
      returnTime
    )) {
      toast.error(t('rentalTime.returnAfterPickupError'));
      return;
    }
    if (item?.owner_id === user.id) {
      toast.error(t('itemDetail.cantBookOwnItem'));
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmBooking = async () => {
    if (!item || !user || !dateRange?.from || !dateRange?.to) return;
    if (confirming) return;
    if (!pickupTime || !returnTime) return;
    setConfirming(true);
    setIsBooking(true);
    setShowConfirmDialog(false);
    try {
      const instantBook = item.instant_book_enabled === true;
      const from = dateRange.from.toISOString().split('T')[0];
      const to = dateRange.to.toISOString().split('T')[0];
      const hours = rentalHours(from, to, pickupTime, returnTime);
      const dayRate = Number(item.price_per_day);
      const hourRate = Number(item.price_per_hour) || null;
      const subtotal = computeRentalSubtotal(dayRate, hourRate, hours);
      const total = computeRentalTotal(dayRate, hourRate, hours);
      const durationDiscount = Math.max(0, Math.round((subtotal - total) * 100) / 100);

      const bookingResult = await supabase.functions.invoke('request-booking', {
        body: {
          itemId: item.id, startDate: from,
          endDate: to, pickupTime, returnTime, renterId: user.id,
          ownerId: item.owner_id, totalPrice: total, originalTotalPrice: subtotal,
          discountAmount: durationDiscount, promoCodeId: null, instantBook, agreeToTerms,
        }
      });
      if (bookingResult.error) throw new Error(bookingResult.error.message);
      toast.success(instantBook ? t('itemDetail.bookingConfirmed') : t('itemDetail.requestSent'));
      navigate(-1);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('itemDetail.anErrorOccurred'));
    } finally { setConfirming(false); setIsBooking(false); }
  };

  const handleMessageOwner = async () => {
    if (!user) { toast.error(t('itemDetail.signInToMessage')); navigate('/auth'); return; }
    if (item?.owner_id === user.id) { toast.error(t('itemDetail.cantMessageSelf')); return; }
    navigate('/messages', { state: { recipientId: item?.owner_id } });
  };

  const getPriceBreakdown = () => {
    if (!item || !dateRange?.from || !dateRange?.to) return null;
    const from = dateRange.from.toISOString().split('T')[0];
    const to = dateRange.to.toISOString().split('T')[0];
    const hours = rentalHours(from, to, pickupTime || '09:00', returnTime || '18:00');
    const dayRate = Number(item.price_per_day);
    const hourRate = Number(item.price_per_hour) || null;
    const subtotal = computeRentalSubtotal(dayRate, hourRate, hours);
    const deposit = Number(item.deposit_amount) || 0;
    const total = computeRentalTotal(dayRate, hourRate, hours);
    return {
      days: rentalDays(from, to),
      hours,
      subtotal,
      deposit,
      total,
      discount: Math.max(0, Math.round((subtotal - total) * 100) / 100),
    };
  };

  if (loading) {
    return (
      <PageLayout>
        <SEO title={t('itemDetail.pageTitle')} />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <SkeletonV2 variant="rectangular" className="aspect-video rounded-lg" />
            <div className="space-y-3">
              <SkeletonV2 variant="text" className="h-8 w-3/4" />
              <SkeletonV2 variant="text" className="h-4 w-full" />
            </div>
          </div>
          <div className="card-base p-6 space-y-4">
            <SkeletonV2 variant="text" className="h-6 w-1/2" />
            <SkeletonV2 variant="rectangular" className="h-64 rounded-lg" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!item) {
    return (
      <PageLayout variant="narrow" className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <PackageX className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-1">{t('itemDetail.itemNotFound')}</h3>
          <p className="text-sm text-muted-foreground mb-3">{loadError || t('itemDetail.itemNotFoundDesc')}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            {t('itemDetail.browseItems')}
          </Button>
        </div>
      </PageLayout>
    );
  }

  const priceBreakdown = getPriceBreakdown();
  const descriptionTruncated = item.description && item.description.length > 120;

  return (
    <PageLayout>
      <SEO title={`${item.title} — RENTY`} description={item.description} image={item.images?.[0]?.image_url} />

      <div className="pb-44 md:pb-0">
        <div className="md:hidden mb-3">
          <BackButton fallbackPath="/search" />
        </div>

        {/* Mobile: stacked. Desktop: 12-col marketplace layout — gallery span 7, sticky booking sidebar span 5 */}
        <div className="grid md:grid-cols-12 gap-6 lg:gap-10">
          <div className="space-y-5 md:col-span-7">
            <ImageCarousel images={item.images || []} title={item.title} />

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full text-xs capitalize">{item.category}</Badge>
                    {item.item_condition && (
                      <Badge variant="secondary" className="rounded-full text-xs capitalize">
                        {item.item_condition === 'like_new' ? t('itemDetail.likeNew') : item.item_condition}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight mb-1">{item.title}</h1>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <SaveItemButton itemId={item.id} />
                  <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Share" onClick={async () => {
                    if (isNative()) {
                      try {
                        const { Share } = await import('@capacitor/share');
                        await Share.share({ title: item.title, url: window.location.href });
                      } catch {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Link copied!');
                      }
                    } else {
                      navigator.share?.({ title: item.title, url: window.location.href }).catch(() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Link copied!');
                      });
                    }
                  }}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {item.location}
                </span>
                {item.cancellation_policy && (
                  <span>{item.cancellation_policy === 'flexible' ? t('itemDetail.freeCancellation') : item.cancellation_policy === 'moderate' ? t('itemDetail.moderateCancellation') : t('itemDetail.strictCancellation')}</span>
                )}
                {Number(item.deposit_amount) > 0 && (
                  <span>RM{Number(item.deposit_amount).toFixed(0)} deposit</span>
                )}
                {item.minimum_rental_days && item.minimum_rental_days > 1 && (
                  <span>{t('itemDetail.minDays', { count: item.minimum_rental_days })}</span>
                )}
              </div>

              <div className="text-sm md:text-[15px] text-muted-foreground leading-relaxed max-w-prose">
                <p>
                  {showFullDesc || !descriptionTruncated
                    ? item.description
                    : item.description?.slice(0, 120) + '...'}
                </p>
                {descriptionTruncated && (
                  <button
                    onClick={() => setShowFullDesc(!showFullDesc)}
                    className="text-primary font-medium text-xs mt-1 inline-flex items-center gap-0.5"
                    aria-expanded={showFullDesc}
                  >
                    {showFullDesc ? t('itemDetail.showLess') : t('itemDetail.readMore')} <ChevronDown className={`h-3 w-3 transition-transform ${showFullDesc ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              <Separator />

              {item.owner && (
                <VendorCard
                  name={item.owner.full_name}
                  avatar={item.owner.avatar_url}
                  location={item.location}
                  verificationLevel={item.owner.verification_level}
                  trustScore={item.owner.trust_score}
                  vendorTrustScore={item.owner.vendor_trust_score}
                  onClick={() => navigate(`/users/${item.owner_id}`)}
                />
              )}

              {user?.id !== item.owner_id && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMessageOwner}>
                  <MessageCircle className="h-4 w-4" />
                  {t('itemDetail.messageOwner')}
                </Button>
              )}

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">{t('itemDetail.reviews')}</h3>
                <ReviewsList itemId={id || ''} />
              </div>
            </div>
          </div>

          <div id="booking-section" className="space-y-4 md:col-span-5 md:sticky md:top-24 self-start">
            <div className="card-base p-6 lg:p-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold">RM{Number(item.price_per_day).toFixed(0)}</span>
                  <span className="text-muted-foreground text-sm"> /day</span>
                </div>
                {item.instant_book_enabled && (
                  <Badge className="rounded-full">{t('itemDetail.instantBook')}</Badge>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t('itemDetail.pickDates')}</p>
                <UnifiedCalendar
                  itemId={id || ''}
                  mode="select"
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                />
              </div>

              {dateRange?.from && dateRange?.to && (
                <div className="space-y-3">
                  <Separator />
                  <TimePicker
                    label={t('rentalTime.pickupTime')}
                    value={pickupTime}
                    onChange={setPickupTime}
                  />
                  <TimePicker
                    label={t('rentalTime.returnTime')}
                    value={returnTime}
                    onChange={setReturnTime}
                  />
                  {pickupTime && returnTime && isSameDayReturnValid(
                    dateRange.from.toISOString().split('T')[0],
                    dateRange.to.toISOString().split('T')[0],
                    pickupTime,
                    returnTime
                  ) ? (
                    <p className="text-xs text-muted-foreground">
                      {formatRentalPeriod(
                        dateRange.from.toISOString().split('T')[0],
                        dateRange.to.toISOString().split('T')[0],
                        pickupTime,
                        returnTime
                      )}
                      {priceBreakdown && <> · {formatDuration(priceBreakdown.hours)}</>}
                    </p>
                  ) : (
                    pickupTime && returnTime ? (
                      <p className="text-xs text-destructive">{t('rentalTime.returnAfterPickupError')}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('rentalTime.selectTimesHint')}</p>
                    )
                  )}
                </div>
              )}

              {priceBreakdown && (
                <>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span>{formatDuration(priceBreakdown.hours)} @ RM{Number(item.price_per_day).toFixed(0)}/day</span>
                      <span>RM{priceBreakdown.subtotal.toFixed(2)}</span>
                    </div>
                    {priceBreakdown.discount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>{t('rentalTime.durationDiscount')} ({discountPercentForHours(priceBreakdown.hours)}%)</span>
                        <span>-RM{priceBreakdown.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {priceBreakdown.deposit > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('itemDetail.securityDeposit')}</span>
                        <span>RM{priceBreakdown.deposit.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                      <span>{t('itemDetail.total')}</span>
                      <span>RM{priceBreakdown.total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}

              {user && !profile?.is_verified && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
                  <p className="text-warning font-medium mb-1">{t('itemDetail.verificationRequired')}</p>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate('/verification', { state: { redirectTo: `/items/${item?.id}` } })}>
                    Verify now
                  </Button>
                </div>
              )}

              {user?.id !== item.owner_id && (
                <>
                  <Button
                    variant="secondary"
                    className="w-full h-12 font-semibold"
                    onClick={handleBooking}
                    disabled={!dateRange?.from || !dateRange?.to || isBooking || (!!user && !profile?.is_verified)}
                  >
                    {isBooking ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('itemDetail.processing')}</span>
                    ) : item.instant_book_enabled ? t('itemDetail.confirmInstantBooking') : t('itemDetail.requestBooking')}
                  </Button>
                  {!dateRange?.from && !isBooking && !(user && !profile?.is_verified) && (
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      {t('itemDetail.selectDatesHelper')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Similar items — full-width row on desktop, tucked under content on mobile */}
        {similarItems.length > 0 && (
          <div className="space-y-4 mt-8 md:mt-12">
            <h3 className="font-semibold md:text-lg">{t('itemDetail.similarItems')}</h3>
            <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
              {loadingSimilar ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-border">
                    <SkeletonV2 variant="rectangular" className="aspect-golden" />
                    <div className="p-3 space-y-2"><SkeletonV2 variant="text" /><SkeletonV2 variant="text" className="w-1/2" /></div>
                  </div>
                ))
              ) : (
                similarItems.slice(0, 4).map((si) => (
                  <ListingCard
                    key={si.id} id={si.id} title={si.title}
                    image={si.images?.[0]?.image_url || ''}
                    pricePerDay={si.price_per_day} category={si.category} location={si.location}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {user?.id !== item.owner_id && (
        <StickyBookingBar
          pricePerDay={item.price_per_day}
          totalPrice={priceBreakdown?.total}
          onBook={scrollToBooking}
          disabled={isBooking}
          isLoading={isBooking}
          hasDates={!!dateRange?.from && !!dateRange?.to}
          hasTimes={!!pickupTime && !!returnTime}
        />
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.instant_book_enabled ? 'Confirm Booking' : 'Send Request'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{item.instant_book_enabled ? 'Review before confirming' : 'Review before sending your request to the owner.'}</p>
                {dateRange?.from && dateRange?.to && item && priceBreakdown && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('itemDetail.duration')}</span>
                      <span className="font-medium">{formatRentalPeriod(
                        dateRange.from.toISOString().split('T')[0],
                        dateRange.to.toISOString().split('T')[0],
                        pickupTime,
                        returnTime
                      )} · {formatDuration(priceBreakdown.hours)}</span>
                    </div>
                    <Separator />
                    {priceBreakdown.deposit > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{t('itemDetail.securityDeposit')}</span>
                        <span>RM {priceBreakdown.deposit.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total</span>
                      <span>RM {priceBreakdown.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {item.instant_book_enabled
                    ? 'Your booking will be confirmed immediately.'
                    : 'The owner will review and confirm your request.'}
                </p>
                <label className="flex items-start gap-2 pt-1 cursor-pointer min-h-[44px] min-w-[44px]">
                  <Checkbox
                    id="agree-terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="agree-terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                    {t('rentalAgreement.agreeToTermsLabel')}{" "}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => setShowAgreementDialog(true)}
                    >
                      {t('rentalAgreement.viewAgreement')}
                    </button>
                  </Label>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirmBooking(); }} disabled={confirming || !agreeToTerms}>
              {confirming ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending...</span>
              ) : item.instant_book_enabled ? 'Confirm' : 'Send Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAgreementDialog} onOpenChange={setShowAgreementDialog}>
        <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rentalAgreement.dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('rentalAgreement.vendor')}</span>
                    <span className="font-medium">{item?.owner?.full_name || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('rentalAgreement.renter')}</span>
                    <span className="font-medium">{profile?.full_name || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('rentalAgreement.itemTitle')}</span>
                    <span className="font-medium">{item?.title || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('rentalAgreement.totalPrice')}</span>
                    <span className="font-medium">RM {priceBreakdown?.total.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
                <ol className="space-y-3 text-xs text-foreground/90">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <li key={n} className="flex gap-2">
                      <span className="shrink-0 font-mono text-primary">{String(n).padStart(2, "0")}</span>
                      <span>{t(`rentalAgreement.clause${n}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
