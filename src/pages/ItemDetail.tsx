import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Item } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { ReportDialog } from '@/components/trust/ReportDialog';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { ReviewsList } from '@/components/ReviewsList';
import { ListingAnalytics } from '@/components/ListingAnalytics';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { MapPin, User, Package, Calendar as CalendarIcon, ShieldCheck, Share2, Pencil, MessageCircle, Loader2, Flag, Eye, Clock, Ticket, AlertTriangle } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import ImageCarousel from '@/components/ImageCarousel';
import { PinchToZoom } from '@/components/PinchToZoom';
import { ListingCard } from '@/components/ListingCard';
import { addRecentlyViewed } from '@/hooks/use-recently-viewed';
import SkeletonCard from '@/components/SkeletonCard';
import SEO from '@/components/SEO';
import { UnifiedCalendar } from '@/components/UnifiedCalendar';
import { SaveItemButton } from '@/components/SaveItemButton';
import { SocialProof } from '@/components/SocialProof';
import { UserTrustBadge } from '@/components/trust/UserTrustBadge';
import StickyBookingBar from '@/components/StickyBookingBar';
import PeaceOfMind from '@/components/PeaceOfMind';
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
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isBooking, setIsBooking] = useState(false);
  const [similarItems, setSimilarItems] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; code: string; discountType: string; discountAmount: number } | null>(null);
  const [recentViewers, setRecentViewers] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (id) {
      setLoadError(null);
      // Validate UUID format before fetching
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        setItem(null);
        setLoading(false);
        setLoadError("Invalid item ID");
        return;
      }
      
      fetchItem();
      trackView();
      fetchRecentViewers();
    }
  }, [id]);

  const trackView = async () => {
    if (!id) return;
    
    try {
      await supabase.from('user_views').insert({
        user_id: user?.id || null,
        item_id: id,
      });

      // Increment view count
      await supabase.rpc('increment_item_views', { item_id_param: id });
    } catch (error) {
      // Silently fail - view tracking is not critical
      console.error('View tracking error:', error);
    }
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

      addRecentlyViewed({
        id: data.id,
        title: data.title,
        image: data.images?.[0]?.image_url || '',
        pricePerDay: Number(data.price_per_day),
        category: data.category,
        location: data.location,
      });

      // Fetch similar items
      if (data) {
        fetchSimilarItems(data.category, data.id);
      }
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'An error occurred');
      toast.error('Failed to load item');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarItems = async (category: string, currentItemId: string) => {
    if (!mountedRef.current) return;
    setLoadingSimilar(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          images:item_images(*)
        `)
        .eq('category', category)
        .eq('is_available', true)
        .neq('id', currentItemId)
        .limit(4);

      if (error) throw error;

      // Fetch ratings for similar items
      const itemIds = (data || []).map(i => i.id);
      if (itemIds.length > 0) {
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

        const itemsWithRatings = (data || []).map(item => {
          const ratings = reviewsByItem.get(item.id) || [];
          const count = ratings.length;
          return {
            ...item,
            rating: count > 0 ? ratings.reduce((s, r) => s + r, 0) / count : 0,
            reviewCount: count,
          };
        });

        setSimilarItems(itemsWithRatings);
      } else {
        setSimilarItems([]);
      }
    } catch (error) {
      console.error('Failed to load similar items:', error);
      setSimilarItems([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  // Restore pending booking state from auth redirect
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
          if (booking.promoCode) {
            setPromoCode(booking.promoCode);
          }
        }
      } catch { /* ignore invalid data */ }
      sessionStorage.removeItem('renty_pending_booking');
    }
  }, [id]);

  const fetchRecentViewers = async () => {
    if (!id) return;
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('item_views')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', id)
        .gte('viewed_at', fifteenMinAgo);
      setRecentViewers(count || 0);
    } catch {
      // non-critical
    }
  };

  const handleValidatePromo = async () => {
    if (!user) {
      toast.error("Please sign in to use a promo code");
      return;
    }
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
        toast.success(`Promo code applied! ${data.promoCode.discountType === 'percentage' ? data.promoCode.discountAmount + '% off' : 'RM' + data.promoCode.discountAmount + ' off'}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid promo code");
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
    if (!user) {
      // Save booking state before redirect
      if (dateRange?.from && dateRange?.to) {
        sessionStorage.setItem('renty_pending_booking', JSON.stringify({
          itemId: item?.id,
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
          promoCode: appliedPromo?.code || '',
        }));
      }
      toast.error('Please sign in to book');
      navigate('/auth', { state: { redirectTo: `/items/${item?.id}` } });
      return;
    }

    if (!profile?.is_verified) {
      toast.error('Verification required to book items');
      navigate('/verification', { state: { redirectTo: `/items/${item?.id}` } });
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Please select dates');
      return;
    }

    if (item?.owner_id === user.id) {
      toast.error("You can't book your own item");
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

    setConfirming(true);
    setIsBooking(true);
    setShowConfirmDialog(false);

    try {
      const days = differenceInDays(dateRange.to, dateRange.from) + 1;
      const instantBook = item.instant_book_enabled === true;
      const finalTotal = getTotalAfterPromo();
      const originalTotal = getPriceBreakdown()?.total;
      const promoDiscount = appliedPromo
        ? (appliedPromo.discountType === 'fixed'
          ? (appliedPromo.discountAmount || 0)
          : ((originalTotal || 0) * ((appliedPromo.discountAmount || 0) / 100)))
        : 0;

      const { data, error } = await supabase.functions.invoke('request-booking', {
        body: {
          itemId: item.id,
          startDate: dateRange.from.toISOString().split('T')[0],
          endDate: dateRange.to.toISOString().split('T')[0],
          renterId: user.id,
          ownerId: item.owner_id,
          totalPrice: finalTotal,
          originalTotalPrice: originalTotal,
          discountAmount: promoDiscount,
          promoCodeId: appliedPromo?.id || null,
          instantBook
        }
      });

      if (error) throw error;

      if (instantBook) {
        toast.success('Booking confirmed!', {
          description: 'Your instant booking has been confirmed. Check your dashboard for details.'
        });
      } else {
        toast.success('Request sent! Waiting for owner approval.', {
          description: 'You will be notified when the owner responds to your request.'
        });
      }
      
      navigate('/dashboard');

    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
      console.error(error);
    } finally {
      setConfirming(false);
      setIsBooking(false);
    }
  };

  const handleMessageOwner = async () => {
    if (!user) {
      toast.error('Please sign in to message');
      navigate('/auth');
      return;
    }

    if (item?.owner_id === user.id) {
      toast.error("You can't message yourself");
      return;
    }

    // Create initial message or just navigate to messages
    navigate('/messages', { state: { recipientId: item?.owner_id } });
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

  const calculatePrice = () => {
    if (!item) return 0;
    const days = getRentalDays();
    return days * item.price_per_day;
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
        <SEO
          title={item?.title || "Item Detail"}
          description={item?.description || "View item details and book your rental"}
          image={item?.images?.[0]?.image_url}
        />
        <Header />
        <div className="container mx-auto p-4 pb-32 md:pb-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg animate-pulse" />
              <Card className="p-6 space-y-4">
                <div className="h-8 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded w-full animate-pulse" />
                <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
              </Card>
            </div>
            <Card className="p-6 space-y-4">
              <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
              <div className="h-64 bg-muted rounded animate-pulse" />
            </Card>
          </div>
        </div>
      </>
    );
  }

  if (!item) {
    return (
      <>
          <Header />
        <div className="container mx-auto p-4 pb-mobile-nav">
          <EmptyState
            icon={Package}
            title={loadError ? "Failed to Load Item" : "Item Not Found"}
            description={loadError || "The item you're looking for doesn't exist or has been removed."}
            actionLabel="Browse Items"
            onAction={() => navigate('/search')}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
        <div className="container mx-auto p-4 pb-32 md:pb-4">
        {/* Mobile Back Button */}
        <div className="md:hidden mb-4">
          <BackButton fallbackPath="/search" />
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <ImageCarousel images={item.images || []} title={item.title} />
            
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <CardTitle>{item.title}</CardTitle>
                    <SocialProof itemId={item.id} />
                  </div>
                  <div className="flex gap-2">
                    {user?.id === item.owner_id && (
                      <Button variant="outline" size="sm" onClick={() => navigate('/my-listings')}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t('common.edit')}
                      </Button>
                    )}
                    <SaveItemButton itemId={item.id} />
                    <Button variant="ghost" size="icon" aria-label="Share this item" onClick={() => {
                      navigator.share?.({ 
                        title: item.title, 
                        url: window.location.href 
                      }).catch(() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Link copied to clipboard');
                      });
                    }}>
                      <Share2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <Badge className="w-fit">{item.category}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{item.description}</p>
                
                {/* Specifications */}
                <SpecificationsSection specifications={item.specifications || {}} category={item.category} />
                
                <div className="flex items-center gap-2 text-sm mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>{item.location}</span>
                </div>
                
                {/* Owner Trust Panel */}
                <div className="flex items-start gap-3 mb-4 p-3 bg-muted/40 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                      {item.owner ? (
                        <Link to={`/users/${item.owner_id}`} className="hover:underline font-medium truncate">
                          {item.owner.full_name}
                        </Link>
                      ) : (
                        <span>Unknown</span>
                      )}
                      {item.owner_id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-xs ml-auto"
                          onClick={() => setShowReport(true)}
                        >
                          <Flag className="h-3 w-3 mr-1" />
                          Report
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {item.owner && (
                        <UserTrustBadge
                          level={item.owner.verification_level}
                          trustScore={item.owner.trust_score}
                          showScore
                          size="sm"
                        />
                      )}
                      {item.owner?.response_rate != null && (
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {item.owner.response_rate}% response rate
                        </span>
                      )}
                      {item.owner?.total_rentals_completed != null && item.owner.total_rentals_completed > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {item.owner.total_rentals_completed} rental{item.owner.total_rentals_completed !== 1 ? 's' : ''} completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Price + Condition + Cancellation Policy + Urgency */}
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(item.price_per_day)}/day
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.cancellation_policy && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <ShieldCheck className="h-3 w-3" />
                        {item.cancellation_policy === 'flexible' ? 'Free Cancel' : item.cancellation_policy === 'moderate' ? 'Moderate Cancel' : 'Strict Cancel'}
                      </Badge>
                    )}
                    {recentViewers > 0 && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Eye className="h-3 w-3" />
                        {recentViewers} viewing now
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Item Condition + Deposit */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {item.item_condition && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {item.item_condition === 'like_new' ? 'Like New' : item.item_condition}
                    </Badge>
                  )}
                  {Number(item.deposit_amount) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      RM{Number(item.deposit_amount).toFixed(0)} deposit required
                    </span>
                  )}
                </div>
                {/* Peace of Mind */}
                <div className="mb-4">
                  <PeaceOfMind />
                </div>
                
                {user?.id === item.owner_id && <ListingAnalytics itemId={item.id} />}
              </CardContent>
            </Card>
            
            {/* Similar Items */}
            {similarItems.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Similar Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {loadingSimilar ? (
                      [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
                    ) : (
                      similarItems.map((similarItem) => (
                        <ListingCard 
                          key={similarItem.id}
                          id={similarItem.id}
                          title={similarItem.title}
                          image={similarItem.images?.[0]?.image_url || ''}
                          pricePerDay={similarItem.price_per_day}
                          category={similarItem.category}
                          rating={similarItem.rating || 0}
                          reviewCount={similarItem.reviewCount || 0}
                          location={similarItem.location}
                          isOwnerVerified={similarItem.owner?.is_verified || false}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Quick Question */}
            {user?.id !== item.owner_id && (
              <div className="mt-6">
                <QuickQuestion ownerId={item.owner_id} ownerName={item.owner?.full_name || "the owner"} />
              </div>
            )}

            {/* Reviews Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <ReviewsList itemId={id || ''} />
              </CardContent>
            </Card>
          </div>
          
          {/* Booking Section */}
          <div id="booking-section" className="space-y-4 sticky top-20 self-start">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Book this item</CardTitle>
                  {item.instant_book_enabled && (
                    <Badge className="bg-green-500 hover:bg-green-600">Instant Book</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Select Rental Dates</Label>
                  <div className="flex gap-2 mt-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                      Save 10% ≥7 days
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                      Save 20% ≥30 days
                    </span>
                  </div>
                  <UnifiedCalendar
                    itemId={id || ''}
                    mode="select"
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                </div>

                {dateRange?.from && dateRange?.to && (() => {
                  const b = getPriceBreakdown();
                  if (!b) return null;
                  const totalAfterPromo = getTotalAfterPromo();
                  return (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>RM{Number(item.price_per_day).toFixed(0)} × {b.days} {b.days === 1 ? 'day' : 'days'}</span>
                        <span>RM{b.subtotal.toFixed(2)}</span>
                      </div>
                      {b.discountPct > 0 && (
                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                              -{b.discountPct}%
                            </span>
                            {b.days >= 30 ? 'Monthly' : 'Weekly'} discount
                          </span>
                          <span>-RM{b.discount.toFixed(2)}</span>
                        </div>
                      )}
                      {b.deposit > 0 && (<>
                  <div className="flex justify-between text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              Security deposit (refundable — collect at pickup)
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted text-[10px] cursor-help" title="Deposit is collected in person at pickup, not via online payment. Refunded upon safe return.">?</span>
                            </span>
                            <span>RM{b.deposit.toFixed(2)}</span>
                          </div>
                            <p className="text-[11px] text-muted-foreground/70 -mt-1">
                              Not charged via online payment — arrange with owner at pickup
                            </p>
                      </>)}
                      <Separator />
                      {appliedPromo && (
                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                          <span>Promo: {appliedPromo.code}</span>
                          <span>-{appliedPromo.discountType === 'percentage' ? `${appliedPromo.discountAmount}%` : `RM${appliedPromo.discountAmount}`}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold">
                        <span>Total payable via ToyyibPay</span>
                        <span>RM{totalAfterPromo.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Platform fee (10%) deducted from owner's payout. Deposit collected at pickup.
                      </p>
                    </div>
                  </>
                  );
                })()}

                {/* Promo Code */}
                <div className="space-y-2">
                  <Label>Promo Code</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleValidatePromo()}
                      className="flex-1"
                      disabled={!!appliedPromo}
                    />
                    {appliedPromo ? (
                      <Button variant="outline" size="sm" onClick={() => { setAppliedPromo(null); setPromoCode(""); }}>
                        Remove
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={handleValidatePromo} disabled={!promoCode.trim() || promoCodeLoading}>
                        {promoCodeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                {user && !profile?.is_verified && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                    <p className="text-amber-800 dark:text-amber-400 font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Verification required to book
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      You need to verify your account before you can book this item.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8 text-xs"
                      onClick={() => navigate('/verification', { state: { redirectTo: `/items/${item?.id}` } })}
                    >
                      Verify Now
                    </Button>
                  </div>
                )}

                {user?.id !== item.owner_id && (
                  <>
                    <Button 
                      variant="outline"
                      className="w-full" 
                      size="lg"
                      onClick={handleMessageOwner}
                    >
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Message Owner
                    </Button>

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleBooking}
                      disabled={!dateRange?.from || !dateRange?.to || isBooking || (!!user && !profile?.is_verified)}
                    >
                      {isBooking ? 'Processing...' : item.instant_book_enabled ? 'Instant Book' : 'Request Booking'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Booking Bar */}
      {user?.id !== item.owner_id && (
        <StickyBookingBar
          pricePerDay={item.price_per_day}
          totalPrice={getTotalAfterPromo()}
          dateLabel={getDateLabel()}
          onBook={scrollToBooking}
          disabled={isBooking}
          isLoading={isBooking}
          instantBookEnabled={item.instant_book_enabled}
        />
      )}

      {/* Booking Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.instant_book_enabled ? 'Confirm Instant Booking' : 'Confirm Booking Request'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Please review your booking details before {item.instant_book_enabled ? 'confirming' : 'sending the request'}.</p>
                {dateRange?.from && dateRange?.to && item && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">
                        {differenceInDays(dateRange.to, dateRange.from) + 1} day(s)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">
                        RM {item.price_per_day} × {differenceInDays(dateRange.to, dateRange.from) + 1}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total</span>
                      <span>RM {getTotalAfterPromo()}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {item.instant_book_enabled
                    ? 'Your booking will be confirmed immediately. You can proceed with the rental right away.'
                    : 'The owner will review and approve your request. You\'ll be notified once they respond.'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmBooking(); }}
              disabled={confirming}
            >
              {confirming ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Request...
                </span>
              ) : (
                item.instant_book_enabled ? 'Confirm Instant Booking' : 'Send Booking Request'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        targetType="item"
        targetId={id || ""}
      />
    </>
  );
}
