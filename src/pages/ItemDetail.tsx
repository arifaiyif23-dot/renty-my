import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Item } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { ReviewsList } from '@/components/ReviewsList';
import { ListingAnalytics } from '@/components/ListingAnalytics';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { MapPin, User, Package, Calendar as CalendarIcon, ShieldCheck, Share2, Pencil, MessageCircle, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import ImageCarousel from '@/components/ImageCarousel';
import { PinchToZoom } from '@/components/PinchToZoom';
import ItemCard from '@/components/ItemCard';
import SkeletonCard from '@/components/SkeletonCard';
import SEO from '@/components/SEO';
import { UnifiedCalendar } from '@/components/UnifiedCalendar';
import { SaveItemButton } from '@/components/SaveItemButton';
import { SocialProof } from '@/components/SocialProof';
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
  const { user } = useAuth();
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
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          owner:profiles(*),
          images:item_images(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);

      // Fetch similar items
      if (data) {
        fetchSimilarItems(data.category, data.id);
      }
    } catch (error: any) {
      setLoadError(error.message || 'Failed to load item');
      toast.error('Failed to load item');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarItems = async (category: string, currentItemId: string) => {
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

  const handleBooking = async () => {
    if (!user) {
      toast.error('Please sign in to book');
      navigate('/auth');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single();
    
    if (!profileData?.is_verified) {
      toast.error('Verification required to book items');
      navigate('/verification');
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

    setShowConfirmDialog(true);
  };

  const handleConfirmBooking = async () => {
    if (!item || !user || !dateRange?.from || !dateRange?.to) return;

    setConfirming(true);
    setIsBooking(true);
    setShowConfirmDialog(false);

    try {
      const days = differenceInDays(dateRange.to, dateRange.from) + 1;
      const rentalPrice = days * item.price_per_day;

      const { data, error } = await supabase.functions.invoke('request-booking', {
        body: {
          itemId: item.id,
          startDate: dateRange.from.toISOString().split('T')[0],
          endDate: dateRange.to.toISOString().split('T')[0],
          renterId: user.id,
          ownerId: item.owner_id,
          totalPrice: rentalPrice
        }
      });

      if (error) throw error;

      toast.success('Request sent! Waiting for owner approval.', {
        description: 'You will be notified when the owner responds to your request.'
      });
      
      navigate('/dashboard');

    } catch (error: any) {
      toast.error(error.message || 'Failed to send booking request');
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

  const calculatePrice = () => {
    if (!dateRange?.from || !dateRange?.to || !item) return 0;
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    return days * item.price_per_day;
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
        <div className="container mx-auto p-4 pb-mobile-nav">
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
      <div className="container mx-auto p-4 pb-20 md:pb-4">
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
                
                <div className="flex items-center gap-2 text-sm mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>{item.location}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm mb-4">
                  <User className="w-4 h-4" />
                  <span>{item.owner?.full_name}</span>
                  {item.owner?.is_verified && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                
                <div className="text-2xl font-bold mb-4">
                  {new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(item.price_per_day)}/day
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
                        <ItemCard 
                          key={similarItem.id}
                          id={similarItem.id}
                          title={similarItem.title}
                          image={similarItem.images?.[0]?.image_url || ''}
                          pricePerDay={similarItem.price_per_day}
                          category={similarItem.category}
                          rating={similarItem.rating || 0}
                          reviewCount={similarItem.reviewCount || 0}
                          location={similarItem.location}
                          owner_id={similarItem.owner_id}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
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
          <div className="space-y-4 sticky top-20 self-start">
            <Card>
              <CardHeader>
                <CardTitle>Book this item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Select Rental Dates</Label>
                  <UnifiedCalendar
                    itemId={id || ''}
                    mode="select"
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                </div>

                {dateRange?.from && dateRange?.to && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>
                          {new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0 }).format(item.price_per_day)} × {differenceInDays(dateRange.to, dateRange.from) + 1} days
                        </span>
                        <span>{new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(calculatePrice())}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>{new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(calculatePrice())}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Platform fee (10%) will be deducted from owner's payout
                      </p>
                    </div>
                  </>
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
                      disabled={!dateRange?.from || !dateRange?.to || isBooking}
                    >
                      {isBooking ? 'Processing...' : 'Request Booking'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Booking Request</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Please review your booking details before sending the request.</p>
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
                      <span>RM {calculatePrice()}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  The owner will review and approve your request. You'll be notified once they respond.
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
                'Send Booking Request'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
