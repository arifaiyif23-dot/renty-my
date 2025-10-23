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
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { MapPin, User, Package, Calendar as CalendarIcon, ShieldCheck, Share2, Pencil } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import ImageCarousel from '@/components/ImageCarousel';
import ItemCard from '@/components/ItemCard';
import SkeletonCard from '@/components/SkeletonCard';
import SEO from '@/components/SEO';
import { PaymentErrorBoundary } from '@/components/PaymentErrorBoundary';
import { DateRangePicker } from '@/components/DateRangePicker';
import { SaveItemButton } from '@/components/SaveItemButton';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';
import { SocialProof } from '@/components/SocialProof';

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isBooking, setIsBooking] = useState(false);
  const [similarItems, setSimilarItems] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (id) {
      fetchItem();
    }
  }, [id]);

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
        .eq('category', category as any)
        .eq('is_available', true)
        .neq('id', currentItemId)
        .limit(4);

      if (error) throw error;
      setSimilarItems(data || []);
    } catch (error) {
      console.error('Failed to load similar items:', error);
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

    // Check if item requires verification for high-value items
    if (item && item.price_per_day > 500) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', user.id)
        .single();
      
      if (!profileData?.is_verified) {
        toast.error('This item requires ID verification', {
          description: 'High-value items require verified users',
          action: {
            label: 'Verify Now',
            onClick: () => navigate('/verification')
          }
        });
        return;
      }
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Please select dates');
      return;
    }

    if (item?.owner_id === user.id) {
      toast.error("You can't book your own item");
      return;
    }

    setIsBooking(true);
    try {
      const days = differenceInDays(dateRange.to, dateRange.from) + 1;
      const totalPrice = days * (item?.price_per_day || 0);

      // Check user's wallet balance
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .single();

      if (walletError) throw new Error('Failed to check wallet balance');

      const currentBalance = Number(walletData.balance);

      if (currentBalance < totalPrice) {
        toast.error(
          `Insufficient balance. You need RM ${totalPrice.toFixed(2)} but have RM ${currentBalance.toFixed(2)}`,
          { 
            duration: 5000,
            action: {
              label: 'Top Up',
              onClick: () => navigate('/wallet')
            }
          }
        );
        return;
      }

      // Create rental and deduct from wallet in a transaction
      const { data: rentalData, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          item_id: item?.id,
          renter_id: user.id,
          owner_id: item?.owner_id,
          start_date: dateRange.from.toISOString().split('T')[0],
          end_date: dateRange.to.toISOString().split('T')[0],
          total_price: totalPrice,
          payment_status: 'pending',
          payment_method: 'wallet',
        })
        .select()
        .single();

      if (rentalError) throw rentalError;

      // Deduct from renter's wallet
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: currentBalance - totalPrice })
        .eq('user_id', user.id);

      if (deductError) throw deductError;

      // Create wallet transaction record
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: walletData.id,
          amount: -totalPrice,
          type: 'rental_payment',
          description: `Payment for ${item?.title}`,
          reference_id: rentalData.id,
        });

      if (transactionError) throw transactionError;

      // Process payment to owner immediately (rental starts now)
      try {
        await supabase.functions.invoke('process-rental-payment', {
          body: { rentalId: rentalData.id }
        });
      } catch (paymentError) {
        console.error('Failed to process rental payment:', paymentError);
        // Continue - payment will be processed later
      }
      
      toast.success(`Booking confirmed! RM ${totalPrice.toFixed(2)} deducted from your wallet.`);
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
      console.error(error);
    } finally {
      setIsBooking(false);
    }
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
            title="Item Not Found"
            description="The item you're looking for doesn't exist or has been removed."
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
      <div className="container mx-auto p-4 pb-mobile-nav">
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
                  <Button variant="ghost" size="icon" onClick={() => {
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
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{item.description}</p>
              
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{item.location}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span>{item.owner?.full_name}</span>
                {item.owner?.is_verified && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              
              <div className="text-2xl font-bold">
                RM {item.price_per_day}/day
              </div>
            </CardContent>
          </Card>
          
          <AvailabilityCalendar itemId={item.id} />
        </div>

        <PaymentErrorBoundary fallbackMessage="Unable to process booking. Please refresh and try again.">
          <Card>
            <CardHeader>
              <CardTitle>Book this item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Dates</Label>
                <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
              </div>

              {dateRange?.from && dateRange?.to && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span>{differenceInDays(dateRange.to, dateRange.from) + 1} days</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>RM {calculatePrice()}</span>
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleBooking}
                disabled={!dateRange?.from || !dateRange?.to || isBooking}
              >
                {isBooking ? 'Booking...' : 'Request to Book'}
              </Button>
            </CardContent>
          </Card>
        </PaymentErrorBoundary>
      </div>

      <Separator className="my-8" />

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Reviews</h2>
          <ReviewsList itemId={item.id} />
        </div>

        {/* Similar Items */}
        {similarItems.length > 0 && (
          <>
            <Separator className="my-8" />
            <div>
              <h2 className="text-2xl font-bold mb-6">Similar Items</h2>
              {loadingSimilar ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {similarItems.map((similarItem) => (
                    <ItemCard
                      key={similarItem.id}
                      id={similarItem.id}
                      title={similarItem.title}
                      image={similarItem.images?.[0]?.image_url || '/placeholder.svg'}
                      pricePerDay={Number(similarItem.price_per_day)}
                      category={similarItem.category}
                      rating={0}
                      reviewCount={0}
                      location={similarItem.location}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
