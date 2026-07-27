import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Item, Rental, ConditionReport } from '@/types';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReportDialog } from '@/components/trust/ReportDialog';
import { Label } from '@/components/ui/label';
import { ReviewsList } from '@/components/ReviewsList';
import { ListingAnalytics } from '@/components/ListingAnalytics';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { MapPin, Package, ShieldCheck, Share2, Pencil, MessageCircle, Loader2, Flag, Eye, Ticket, AlertTriangle, FileText } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import EnhancedEmptyState from '@/components/EnhancedEmptyState';
import ImageCarousel from '@/components/ImageCarousel';
import { ListingCardV2 } from '@/components/marketplace/ListingCardV2';
import { VendorCard } from '@/components/marketplace/VendorCard';
import { SkeletonV2 } from '@/components/SkeletonV2';
import { addRecentlyViewed } from '@/hooks/use-recently-viewed';
import SEO from '@/components/SEO';
import { UnifiedCalendar } from '@/components/UnifiedCalendar';
import { SaveItemButton } from '@/components/SaveItemButton';
import { SocialProof } from '@/components/SocialProof';
import StickyBookingBar from '@/components/StickyBookingBar';
import PeaceOfMind from '@/components/PeaceOfMind';
import { ConditionReportViewer } from '@/components/ConditionReportViewer';
import QuickQuestion from '@/components/QuickQuestion';
import SpecificationsSection from '@/components/SpecificationsSection';
import { Input } from '@/components/ui/input';
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
  const [isBooking, setIsBooking] = useState(false);
  const [similarItems, setSimilarItems] = useState<Array<{ id: string; title: string; price_per_day: number; images: { image_url: string }[] }>>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; code: string; discountType: string; discountAmount: number } | null>(null);
  const [recentViewers, setRecentViewers] = useState(0);
  const [currentRental, setCurrentRental] = useState<Rental | null>(null);
  const [conditionReports, setConditionReports] = useState<ConditionReport[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [, setLoadingRental] = useState(false);
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
        await supabase.from('user_views').insert({
          user_id: user?.id || null,
          item_id: id,
        });
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
            owner:profiles(id, full_name, avatar_url, is_verified, verification_level, trust_score, response_rate, total_rentals_completed, created_at),
            images:item_images(*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setItem(data);

        // Fetch current user's rental for this item
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
            .then(({ data: rentalData }) => {
              if (mountedRef.current) {
                setCurrentRental(rentalData || null);
                setLoadingRental(false);
              }
            })
            .catch(() => {
              if (mountedRef.current) setLoadingRental(false);
            });
        }

        addRecentlyViewed({
          id: data.id,
          title: data.title,
          image: data.images?.[0]?.image_url || '',
          pricePerDay: Number(data.price_per_day),
          category: data.category,
          location: data.location,
        });

        if (data) {
          fetchSimilarItems(data.category, data.id);
        }
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : t('itemDetail.anErrorOccurred'));
        toast.error(t('itemDetail.failedToLoadItem'));
      } finally {
        setLoading(false);
      }
    };

    const fetchRecentViewers = async () => {
      if (!id) return;
      try {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('user_views')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', id)
          .gte('viewed_at', fifteenMinAgo);
        setRecentViewers(count || 0);
      } catch (e) { console.warn('fetchRecentViewers failed:', e); }
    };

    if (id) {
      setLoadError(null);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        setItem(null);
        setLoading(false);
        setLoadError(t('itemDetail.invalidItemId'));
        return;
      }
      fetchItem();
      trackView();
      fetchRecentViewers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSimilarItems = async (category: string, currentItemId: string) => {
    if (!mountedRef.current) return;
    setLoadingSimilar(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          title,
          price_per_day,
          category,
          location,
          images:item_images(image_url),
          owner:owner_id(verification_level)
        `)
        .eq('category', category)
        .eq('is_available', true)
        .neq('id', currentItemId)
        .limit(4);

      if (error) throw error;

      const itemIds = (data || []).map(i => i.id);
      if (itemIds.length > 0) {
        const { data: allReviews } = await supabase
          .from('rentals')
          .select('item_id, reviews(rating)')
          .in('item_id', itemIds);

        const reviewsByItem = new Map<string, number[]>();
        allReviews?.forEach((rental: { item_id: string; reviews: { rating: number }[] }) => {
          if (rental.reviews?.length) {
            const existing = reviewsByItem.get(rental.item_id) || [];
            reviewsByItem.set(rental.item_id, [...existing, ...rental.reviews.map((r) => r.rating)]);
          }
        });

        setSimilarItems((data || []).map(item => {
          const ratings = reviewsByItem.get(item.id) || [];
          const count = ratings.length;
          return { ...item, rating: count > 0 ? ratings.reduce((s, r) => s + r, 0) / count : 0, reviewCount: count };
        }));
      } else {
        setSimilarItems([]);
      }
    } catch (e) {
      console.error('Similar items fetch error:', e);
      setSimilarItems([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  useEffect(() => {
    const pending = sessionStorage.getItem('renty_pending_booking');
    if (pending) {
      try {
        const booking = JSON.parse(pending);
        if (booking.itemId === id && booking.startDate) {
          setDateRange({
            from: new Date(booking.startDate),
            to: booking.endDate ? new Date(booking.endDate) : undefined,
          });
          if (booking.promoCode) setPromoCode(booking.promoCode);
        }
      } catch (e) { console.error('Pending booking restore error:', e); }
      sessionStorage.removeItem('renty_pending_booking');
    }
  }, [id]);

  const handleValidatePromo = async () => {
    if (!user) { toast.error(t('itemDetail.signInToUsePromo')); return; }
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoCodeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo-code', {
        body: { code, userId: user.id },
      });
      if (error) throw error;
      if (data.valid) {
        setAppliedPromo(data.promoCode);
        toast.success(t('itemDetail.promoCodeApplied', { discount: data.promoCode.discountType === 'percentage' ? `${data.promoCode.discountAmount}%` : `RM${data.promoCode.discountAmount}` }));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('itemDetail.invalidPromoCode'));
      setAppliedPromo(null);
    } finally {
      setPromoCodeLoading(false);
    }
  };

  const scrollToBooking = () => {
    const el = document.getElementById('booking-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleBooking = async () => {
    if (isBooking) return;
    if (!user) {
      if (dateRange?.from && dateRange?.to) {
        sessionStorage.setItem('renty_pending_booking', JSON.stringify({
          itemId: item?.id,
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
          promoCode: appliedPromo?.code || '',
        }));
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
    if (item?.owner_id === user.id) {
      toast.error(t('itemDetail.cantBookOwnItem'));
      return;
    }
    if (item?.instant_book_enabled) {
      handleConfirmBooking();
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmBooking = async () => {
    if (!item || !user || !dateRange?.from || !dateRange?.to) return;
    if (confirming) return;
    setConfirming(true);
    setIsBooking(true);
    setShowConfirmDialog(false);
    try {
      const instantBook = item.instant_book_enabled === true;
      const finalTotal = getTotalAfterPromo();
      const originalTotal = getPriceBreakdown()?.total;
      const promoDiscount = appliedPromo
        ? (appliedPromo.discountType === 'fixed'
          ? (appliedPromo.discountAmount || 0)
          : ((originalTotal || 0) * ((appliedPromo.discountAmount || 0) / 100)))
        : 0;

      const bookingResult = await supabase.functions.invoke('request-booking', {
        body: {
          itemId: item.id, startDate: dateRange.from.toISOString().split('T')[0],
          endDate: dateRange.to.toISOString().split('T')[0], renterId: user.id,
          ownerId: item.owner_id, totalPrice: finalTotal, originalTotalPrice: originalTotal,
          discountAmount: promoDiscount, promoCodeId: appliedPromo?.id || null, instantBook,
        }
      });
      if (bookingResult.error) {
        let msg = bookingResult.error.message;
        if (bookingResult.response) {
          try {
            const body = await bookingResult.response.json();
            if (body?.error) msg = body.error;
          } catch {}
        }
        throw new Error(msg);
      }
      toast.success(instantBook ? t('itemDetail.bookingConfirmed') : t('itemDetail.requestSent'));
      navigate('/dashboard');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('itemDetail.anErrorOccurred'));
    } finally {
      setConfirming(false);
      setIsBooking(false);
    }
  };

  const handleMessageOwner = async () => {
    if (!user) { toast.error(t('itemDetail.signInToMessage')); navigate('/auth'); return; }
    if (item?.owner_id === user.id) { toast.error(t('itemDetail.cantMessageSelf')); return; }
    navigate('/messages', { state: { recipientId: item?.owner_id } });
  };

  const loadConditionReports = async () => {
    if (!currentRental) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.functions.invoke('get-condition-report?rental_id=' + currentRental.id);
    if (data) setConditionReports(data as ConditionReport[]);
  };

  const getRentalDays = () => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInDays(dateRange.to, dateRange.from) + 1;
  };

  const getDiscountPercent = (days: number) => {
    if (days >= 30) return 20;
    if (days >= 7) return 10;
    return 0;
  };

  const getPriceBreakdown = () => {
    const days = getRentalDays();
    if (days === 0 || !item) return null;
    const subtotal = days * item.price_per_day;
    const discountPct = getDiscountPercent(days);
    const discount = subtotal * (discountPct / 100);
    const deposit = Number(item.deposit_amount) || 0;
    return { days, subtotal, discountPct, discount, deposit, total: subtotal - discount };
  };

  const getTotalAfterPromo = () => {
    const b = getPriceBreakdown();
    if (!b) return 0;
    if (!appliedPromo) return b.total;
    const promoDiscount = appliedPromo.discountType === 'fixed'
      ? (appliedPromo.discountAmount || 0)
      : (b.total * ((appliedPromo.discountAmount || 0) / 100));
    return Math.max(0, b.total - promoDiscount);
  };

  const getDateLabel = () => {
    if (!dateRange?.from || !dateRange?.to) return undefined;
    const fmt = (d: Date) => d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
    return `${fmt(dateRange.from)} - ${fmt(dateRange.to)}`;
  };

  if (loading) {
    return (
      <>
        <SEO title={t('itemDetail.pageTitle')} />
        <Header />
        <div className="container mx-auto px-4 py-6 pb-44 md:pb-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <SkeletonV2 variant="rectangular" className="aspect-video rounded-2xl" />
              <div className="space-y-3 p-4">
                <SkeletonV2 variant="text" className="h-8 w-3/4" />
                <SkeletonV2 variant="text" className="h-4 w-full" />
                <SkeletonV2 variant="text" className="h-4 w-5/6" />
              </div>
            </div>
            <GlassCard variant="subtle" padding="lg" className="space-y-4">
              <SkeletonV2 variant="text" className="h-6 w-1/2" />
              <SkeletonV2 variant="rectangular" className="h-64" />
            </GlassCard>
          </div>
        </div>
      </>
    );
  }

  if (!item) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-6 pb-mobile-nav">
          <EnhancedEmptyState
            icon={Package}
            title={loadError ? t('itemDetail.failedToLoad') : t('itemDetail.itemNotFound')}
            description={loadError || t('itemDetail.itemNotFoundDesc')}
            actionLabel={t('itemDetail.browseItems')}
            onAction={() => navigate('/search')}
            showRetry={!!loadError}
            onRetry={() => window.location.reload()}
          />
        </div>
      </>
    );
  }

  const priceBreakdown = getPriceBreakdown();
  const totalAfterPromo = getTotalAfterPromo();

  return (
    <>
      <SEO title={`${item.title} — RENTY`} description={item.description} image={item.images?.[0]?.image_url} />
      <Header />

      <div className="container mx-auto px-4 py-4 pb-44 md:pb-4">
        <div className="md:hidden mb-3">
          <BackButton fallbackPath="/search" />
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          <div className="space-y-5">
            <ImageCarousel images={item.images || []} title={item.title} />

            <GlassCard variant="subtle" padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full text-xs capitalize">
                      {item.category}
                    </Badge>
                    {item.item_condition && (
                      <Badge variant="secondary" className="rounded-full text-xs capitalize">
                        {item.item_condition === 'like_new' ? t('itemDetail.likeNew') : item.item_condition}
                      </Badge>
                    )}
                    {recentViewers > 0 && (
                      <Badge variant="secondary" className="rounded-full text-xs gap-1">
                        <Eye className="h-3 w-3" />
                        {recentViewers} {t('itemDetail.viewingNow')}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">{item.title}</h1>
                  <SocialProof itemId={item.id} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <SaveItemButton itemId={item.id} />
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('itemDetail.share')} onClick={() => {
                    navigator.share?.({ title: item.title, url: window.location.href }).catch(() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success(t('itemDetail.linkCopied'));
                    });
                  }}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  {user?.id === item.owner_id && (
                    <Button variant="outline" size="sm" className="h-9" onClick={() => navigate('/my-listings')}>
                      <Pencil className="h-4 w-4 mr-1.5" />
                      {t('itemDetail.edit')}
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-muted-foreground leading-relaxed">{item.description}</p>

              <SpecificationsSection specifications={item.specifications || {}} category={item.category} />

              <Separator />

              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{item.location}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {item.cancellation_policy && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    {item.cancellation_policy === 'flexible' ? t('itemDetail.freeCancellation') : item.cancellation_policy === 'moderate' ? t('itemDetail.moderateCancellation') : t('itemDetail.strictCancellation')}
                  </span>
                )}
                {Number(item.deposit_amount) > 0 && (
                  <span className="text-muted-foreground">· RM{Number(item.deposit_amount).toFixed(0)} {t('itemDetail.deposit')}</span>
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
                  onClick={() => navigate(`/users/${item.owner_id}`)}
                />
              )}

              {item.owner_id !== user?.id && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowReport(true)} className="gap-1.5">
                    <Flag className="h-4 w-4" />
                    {t('itemDetail.reportItem')}
                  </Button>
                </div>
              )}

              <PeaceOfMind />

              {currentRental && ['active', 'completed', 'disputed'].includes(currentRental.status) && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  loadConditionReports();
                  setViewerOpen(true);
                }}>
                  <FileText className="h-4 w-4" />
                  View Condition Report
                </Button>
              )}

              {user?.id === item.owner_id && <ListingAnalytics itemId={item.id} />}
            </GlassCard>

            {similarItems.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">{t('itemDetail.similarItems')}</h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {loadingSimilar ? (
                    [...Array(2)].map((_, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-border">
                        <SkeletonV2 variant="rectangular" className="aspect-[4/3]" />
                        <div className="p-4 space-y-2"><SkeletonV2 variant="text" /><SkeletonV2 variant="text" className="w-1/2" /></div>
                      </div>
                    ))
                  ) : (
                    similarItems.map((si) => (
                      <ListingCardV2
                        key={si.id}
                        id={si.id}
                        title={si.title}
                        image={si.images?.[0]?.image_url || ''}
                        pricePerDay={si.price_per_day}
                        category={si.category}
                        location={si.location}
                        rating={si.rating || 0}
                        reviewCount={si.reviewCount || 0}
                        badges={si.owner?.verification_level && si.owner.verification_level !== 'unverified' ? ['verified'] : undefined}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {user?.id !== item.owner_id && (
              <QuickQuestion ownerId={item.owner_id} ownerName={item.owner?.full_name || t('itemDetail.theOwner')} />
            )}

            <GlassCard variant="subtle" padding="lg">
              <h2 className="text-lg font-semibold tracking-tight mb-4">{t('itemDetail.reviews')}</h2>
              <ReviewsList itemId={id || ''} />
            </GlassCard>
          </div>

          <div id="booking-section" className="space-y-4 sticky top-20 self-start">
            <GlassCard variant="subtle" padding="lg" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold">RM{Number(item.price_per_day).toFixed(0)}</span>
                  <span className="text-muted-foreground text-sm"> {t('itemDetail.perDay')}</span>
                </div>
                {item.instant_book_enabled && (
                  <Badge variant="brand" className="rounded-full">{t('itemDetail.instantBook')}</Badge>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">{t('itemDetail.selectDates')}</Label>
                <div className="flex gap-2 mt-2 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success border border-success/20">
                    {t('itemDetail.save7Days')}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    {t('itemDetail.save30Days')}
                  </span>
                </div>
                <UnifiedCalendar
                  itemId={id || ''}
                  mode="select"
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                />
              </div>

              {priceBreakdown && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>RM{Number(item.price_per_day).toFixed(0)} × {priceBreakdown.days} {priceBreakdown.days === 1 ? t('itemDetail.day') : t('itemDetail.days')}</span>
                      <span>RM{priceBreakdown.subtotal.toFixed(2)}</span>
                    </div>
                    {priceBreakdown.discountPct > 0 && (
                      <div className="flex justify-between text-sm text-success">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success border border-success/20">
                            -{priceBreakdown.discountPct}%
                          </span>
                          {priceBreakdown.days >= 30 ? t('itemDetail.monthlyDiscount') : t('itemDetail.weeklyDiscount')}
                        </span>
                        <span>-RM{priceBreakdown.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {priceBreakdown.deposit > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {t('itemDetail.securityDeposit')}
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted text-[10px] cursor-help" title={t('itemDetail.depositTooltip')}>?</span>
                          </span>
                          <span>RM{priceBreakdown.deposit.toFixed(2)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 -mt-1">
                          {t('itemDetail.depositNote')}
                        </p>
                      </>
                    )}
                    <Separator />
                    {appliedPromo && (
                      <div className="flex justify-between text-sm text-success">
                        <span>{t('itemDetail.promoLabel')}: {appliedPromo.code}</span>
                        <span>-{appliedPromo.discountType === 'percentage' ? `${appliedPromo.discountAmount}%` : `RM${appliedPromo.discountAmount}`}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span>{t('itemDetail.totalPayable')}</span>
                      <span>RM{totalAfterPromo.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('itemDetail.platformFee')}</p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('itemDetail.promoCode')}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('itemDetail.enterCode')}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidatePromo()}
                    className="flex-1 rounded-xl"
                    disabled={!!appliedPromo}
                  />
                  {appliedPromo ? (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setAppliedPromo(null); setPromoCode(""); }}>
                      {t('itemDetail.remove')}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={handleValidatePromo} disabled={!promoCode.trim() || promoCodeLoading}>
                      {promoCodeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {user && !profile?.is_verified && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl text-sm">
                  <p className="text-warning font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t('itemDetail.verificationRequiredToBook')}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={() => navigate('/verification', { state: { redirectTo: `/items/${item?.id}` } })}>
                    {t('itemDetail.verifyNow')}
                  </Button>
                </div>
              )}

              {user?.id !== item.owner_id && (
                <div className="space-y-2">
                  <Button variant="outline" className="w-full h-12 rounded-xl" onClick={handleMessageOwner}>
                    <MessageCircle className="h-5 w-5 mr-2" />
                    {t('itemDetail.messageOwner')}
                  </Button>
                  <Button
                    variant="default"
                    className="w-full h-12 rounded-xl font-semibold"
                    onClick={handleBooking}
                    disabled={!dateRange?.from || !dateRange?.to || isBooking || (!!user && !profile?.is_verified)}
                  >
                    {isBooking ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('itemDetail.processing')}</span>
                    ) : item.instant_book_enabled ? t('itemDetail.instantBook') : t('itemDetail.requestBooking')}
                  </Button>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>

      {user?.id !== item.owner_id && (
        <StickyBookingBar
          pricePerDay={item.price_per_day}
          totalPrice={totalAfterPromo}
          dateLabel={getDateLabel()}
          onBook={scrollToBooking}
          disabled={isBooking}
          isLoading={isBooking}
          instantBookEnabled={item.instant_book_enabled}
        />
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.instant_book_enabled ? t('itemDetail.confirmInstantBooking') : t('itemDetail.confirmBookingRequest')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{item.instant_book_enabled ? t('itemDetail.reviewBeforeConfirm') : t('itemDetail.reviewBeforeSend')}</p>
                {dateRange?.from && dateRange?.to && item && (
                  <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('itemDetail.duration')}</span>
                      <span className="font-medium">{differenceInDays(dateRange.to, dateRange.from) + 1} {t('itemDetail.days')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('itemDetail.price')}</span>
                      <span className="font-medium">RM {item.price_per_day} × {differenceInDays(dateRange.to, dateRange.from) + 1}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                      <span>{t('itemDetail.total')}</span>
                      <span>RM {totalAfterPromo}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {item.instant_book_enabled
                    ? t('itemDetail.bookingConfirmedImmediately')
                    : t('itemDetail.ownerWillReview')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>{t('itemDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirmBooking(); }} disabled={confirming}>
              {confirming ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('itemDetail.sending')}</span>
              ) : item.instant_book_enabled ? t('itemDetail.confirmBooking') : t('itemDetail.sendRequest')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog open={showReport} onOpenChange={setShowReport} targetType="item" targetId={id || ""} />

      {conditionReports.length > 0 && (
        <ConditionReportViewer
          reports={conditionReports}
          open={viewerOpen}
          onOpenChange={setViewerOpen}
        />
      )}
    </>
  );
}
