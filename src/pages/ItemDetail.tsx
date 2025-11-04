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
import { MapPin, User, Package, Calendar as CalendarIcon, ShieldCheck, Share2, Pencil } from 'lucide-react';
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
import { PaymentErrorBoundary } from '@/components/PaymentErrorBoundary';
import { UnifiedCalendar } from '@/components/UnifiedCalendar';
import { SaveItemButton } from '@/components/SaveItemButton';
import { SocialProof } from '@/components/SocialProof';
import { PromoCodeRedemption } from '@/components/PromoCodeRedemption';
import { InsurancePlans } from '@/components/InsurancePlans';
import { DeliveryScheduler, DeliveryDetails } from '@/components/DeliveryScheduler';

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
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; amount: number; code: string; id: string }>({ type: '', amount: 0, code: '', id: '' });
  const [insurancePlan, setInsurancePlan] = useState<{ type: string; coverage: number; price: number }>({ type: 'basic', coverage: 5000, price: 0 });
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({ method: 'self_pickup', fee: 0 });

  useEffect(() => {
    if (id) {
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
    console.log('🚀 Booking started');
    
    if (!user) {
      console.log('❌ No user logged in');
      toast.error('Please sign in to book');
      navigate('/auth');
      return;
    }

    console.log('✅ User authenticated:', user.id);

    // Check user verification status - now required for all bookings
    console.log('🔒 Checking verification status');
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single();
    
    if (!profileData?.is_verified) {
      console.log('❌ User not verified');
      toast.error('Verification required to book items', {
        description: 'Complete ID verification to start renting',
        action: {
          label: 'Verify Now',
          onClick: () => navigate('/verification')
        }
      });
      return;
    }
    console.log('✅ User verified');

    if (!dateRange?.from || !dateRange?.to) {
      console.log('❌ No dates selected');
      toast.error('Please select dates');
      return;
    }

    console.log('✅ Dates selected:', dateRange.from, dateRange.to);

    if (item?.owner_id === user.id) {
      console.log('❌ User trying to book own item');
      toast.error("You can't book your own item");
      return;
    }

    console.log('✅ Item owner check passed');

    setIsBooking(true);
    try {
      const days = differenceInDays(dateRange.to, dateRange.from) + 1;
      const finalPrice = calculatePrice();
      console.log('💰 Final price calculated:', finalPrice, 'for', days, 'days');

      // Check user's wallet balance
      console.log('🔍 Checking wallet balance...');
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .single();

      if (walletError) {
        console.error('❌ Wallet error:', walletError);
        throw new Error('Failed to check wallet balance');
      }

      const currentBalance = Number(walletData.balance);
      console.log('💵 Current balance:', currentBalance);

      if (currentBalance < finalPrice) {
        console.log('❌ Insufficient balance');
        toast.error(
          `Insufficient balance. You need RM ${finalPrice.toFixed(2)} but have RM ${currentBalance.toFixed(2)}`,
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

      console.log('✅ Sufficient balance, creating rental...');

      // Create rental
      const { data: rentalData, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          item_id: item?.id,
          renter_id: user.id,
          owner_id: item?.owner_id,
          start_date: dateRange.from.toISOString().split('T')[0],
          end_date: dateRange.to.toISOString().split('T')[0],
          total_price: finalPrice,
          payment_status: 'unpaid',
          payment_method: 'wallet',
        })
        .select()
        .single();

      if (rentalError) {
        console.error('❌ Rental creation error:', rentalError);
        // Handle verification error from database
        if (rentalError.message?.includes('violates row-level security policy') || 
            rentalError.message?.includes('is_verified')) {
          toast.error('Verification required to book items', {
            description: 'Complete ID verification to start renting',
            action: {
              label: 'Verify Now',
              onClick: () => navigate('/verification')
            }
          });
          return;
        }
        throw rentalError;
      }

      console.log('✅ Rental created:', rentalData.id);

      // Save insurance details
      if (insurancePlan.type) {
        await supabase.from('rental_insurance').insert({
          rental_id: rentalData.id,
          plan_type: insurancePlan.type,
          coverage_amount: insurancePlan.coverage,
          premium_cost: insurancePlan.price * days,
        });
      }

      // Save delivery details
      if (deliveryDetails.method) {
        await supabase.from('rental_delivery').insert({
          rental_id: rentalData.id,
          delivery_method: deliveryDetails.method,
          delivery_provider: deliveryDetails.provider,
          delivery_fee: deliveryDetails.fee,
          pickup_address: deliveryDetails.pickupAddress,
          pickup_scheduled_at: deliveryDetails.pickupTime,
          return_scheduled_at: deliveryDetails.returnTime,
          delivery_instructions: deliveryDetails.instructions,
        });
      }

      // Track promo code usage
      if (promoDiscount.id) {
        await supabase.from('user_promo_usage').insert({
          user_id: user.id,
          promo_code_id: promoDiscount.id,
        });

        // Increment promo code usage count
        await supabase.rpc('increment_wallet_balance', {
          p_user_id: user.id,
          p_amount: 0 // Just to trigger the update
        });
      }

      // Deduct from renter's wallet using RPC function
      console.log('💸 Deducting from wallet...');
      const { error: deductError } = await supabase.rpc('increment_wallet_balance', {
        p_user_id: user.id,
        p_amount: -finalPrice
      });

      if (deductError) {
        console.error('❌ Wallet deduction error:', deductError);
        throw deductError;
      }

      console.log('✅ Wallet deducted');

      // Create wallet transaction record
      console.log('📝 Creating transaction record...');
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: walletData.id,
          amount: finalPrice,
          type: 'rental_payment',
          description: `Payment for ${item?.title}`,
          reference_id: rentalData.id,
          status: 'completed',
        });

      if (transactionError) {
        console.error('❌ Transaction record error:', transactionError);
        throw transactionError;
      }

      console.log('✅ Transaction recorded');

      // Process payment to owner immediately
      console.log('🔄 Processing payment to owner...');
      try {
        const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('process-rental-payment', {
          body: { rentalId: rentalData.id }
        });
        
        if (paymentError) {
          console.error('⚠️ Payment processing error:', paymentError);
        } else {
          console.log('✅ Payment processed:', paymentResult);
        }
      } catch (paymentError) {
        console.error('⚠️ Payment processing exception:', paymentError);
      }
      
      console.log('🎉 Booking complete!');
      toast.success(`Booking confirmed! RM ${finalPrice.toFixed(2)} deducted from your wallet.`);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('💥 Booking failed:', error);
      toast.error(error.message || 'Failed to create booking');
      console.error(error);
    } finally {
      setIsBooking(false);
    }
  };

  const calculatePrice = () => {
    if (!dateRange?.from || !dateRange?.to || !item) return 0;
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    let total = days * item.price_per_day;
    
    // Add insurance
    total += insurancePlan.price * days;
    
    // Add delivery
    total += deliveryDetails.fee;
    
    // Apply promo discount
    if (promoDiscount.amount > 0) {
      if (promoDiscount.type === 'percentage') {
        total = total - (total * promoDiscount.amount) / 100;
      } else {
        total = total - promoDiscount.amount;
      }
    }
    
    return Math.max(0, total);
  };

  const calculateBreakdown = () => {
    if (!dateRange?.from || !dateRange?.to || !item) return null;
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    const basePrice = days * item.price_per_day;
    const insuranceCost = insurancePlan.price * days;
    const deliveryCost = deliveryDetails.fee;
    const subtotal = basePrice + insuranceCost + deliveryCost;
    
    let discountAmount = 0;
    if (promoDiscount.amount > 0) {
      if (promoDiscount.type === 'percentage') {
        discountAmount = (subtotal * promoDiscount.amount) / 100;
      } else {
        discountAmount = promoDiscount.amount;
      }
    }
    
    return {
      days,
      basePrice,
      insuranceCost,
      deliveryCost,
      subtotal,
      discountAmount,
      total: Math.max(0, subtotal - discountAmount),
    };
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
            <CardContent>
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="insurance">Insurance</TabsTrigger>
                  <TabsTrigger value="delivery">Delivery</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 pt-4">
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
                  
                  {user?.id === item.owner_id && <ListingAnalytics itemId={item.id} />}
                </TabsContent>

                <TabsContent value="insurance" className="pt-4">
                  {dateRange?.from && dateRange?.to && (
                    <InsurancePlans
                      selectedPlan={insurancePlan.type}
                      onPlanSelect={(plan) => setInsurancePlan(plan)}
                      rentalDays={differenceInDays(dateRange.to, dateRange.from) + 1}
                    />
                  )}
                </TabsContent>

                <TabsContent value="delivery" className="pt-4">
                  {dateRange?.from && dateRange?.to && (
                    <DeliveryScheduler
                      itemLocation={item.location}
                      onDeliverySelect={(delivery) => setDeliveryDetails(delivery)}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Similar Items */}
          {similarItems.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Similar Items</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="flex gap-4 pb-4">
                    {similarItems.map((similar) => (
                      <div key={similar.id} className="min-w-[250px]">
                        <ItemCard
                          id={similar.id}
                          title={similar.title}
                          image={similar.images?.[0]?.image_url || ''}
                          pricePerDay={similar.price_per_day}
                          category={similar.category}
                          rating={0}
                          reviewCount={0}
                          location={similar.location}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <PaymentErrorBoundary fallbackMessage="Unable to process booking. Please refresh and try again.">
          <Card>
            <CardHeader>
              <CardTitle>Book this item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Dates</Label>
                <UnifiedCalendar 
                  itemId={item.id} 
                  mode="select" 
                  dateRange={dateRange} 
                  setDateRange={setDateRange} 
                />
              </div>

              {/* Insurance Plans */}
              {dateRange?.from && dateRange?.to && (
                <>
                  <Separator />
                  <InsurancePlans
                    selectedPlan={insurancePlan.type}
                    onPlanSelect={(plan) => setInsurancePlan(plan)}
                    rentalDays={differenceInDays(dateRange.to, dateRange.from) + 1}
                  />
                </>
              )}

              {/* Delivery Options */}
              {dateRange?.from && dateRange?.to && (
                <>
                  <Separator />
                  <DeliveryScheduler
                    itemLocation={item.location}
                    onDeliverySelect={(delivery) => setDeliveryDetails(delivery)}
                  />
                </>
              )}

              {/* Promo Code */}
              {dateRange?.from && dateRange?.to && (
                <>
                  <Separator />
                  <PromoCodeRedemption
                    onPromoApplied={setPromoDiscount}
                    originalPrice={calculatePrice()}
                  />
                </>
              )}

              {/* Price Breakdown */}
              {dateRange?.from && dateRange?.to && (() => {
                const breakdown = calculateBreakdown();
                if (!breakdown) return null;
                
                return (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Base rent ({breakdown.days} days):</span>
                      <span>RM {breakdown.basePrice.toFixed(2)}</span>
                    </div>
                    {breakdown.insuranceCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Insurance ({insurancePlan.type}):</span>
                        <span>RM {breakdown.insuranceCost.toFixed(2)}</span>
                      </div>
                    )}
                    {breakdown.deliveryCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Delivery fee:</span>
                        <span>RM {breakdown.deliveryCost.toFixed(2)}</span>
                      </div>
                    )}
                    {breakdown.discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({promoDiscount.code}):</span>
                        <span>-RM {breakdown.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>RM {breakdown.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

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
          {user?.id === item.owner_id ? (
            <Tabs defaultValue="reviews" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="reviews" className="space-y-4">
                <ReviewsList itemId={item.id} />
              </TabsContent>
              <TabsContent value="analytics" className="space-y-4">
                <ListingAnalytics itemId={item.id} />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6">Reviews</h2>
              <ReviewsList itemId={item.id} />
            </>
          )}
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
