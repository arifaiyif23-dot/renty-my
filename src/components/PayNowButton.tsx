import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Loader2, Clock } from 'lucide-react';
import { Rental } from '@/types';
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
import { Separator } from '@/components/ui/separator';
import { haptics } from '@/utils/haptics';
import { differenceInDays } from 'date-fns';
import { isNative } from '@/lib/platform';

interface PayNowButtonProps {
  rental: Rental;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PayNowButton({ rental }: PayNowButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingExpiresAt, setPendingExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    supabase
      .from('payments')
      .select('expires_at, status')
      .eq('rental_id', rental.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.expires_at) setPendingExpiresAt(data.expires_at);
      })
      .catch((err) => console.error('Failed to check pending payment:', err));
    return () => { active = false; };
  }, [rental.id]);

  useEffect(() => {
    if (!pendingExpiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pendingExpiresAt]);

  const remainingMs = pendingExpiresAt ? new Date(pendingExpiresAt).getTime() - now : 0;
  const hasActiveBill = !!pendingExpiresAt && remainingMs > 0;

  const rentalDays = Math.max(1, differenceInDays(new Date(rental.end_date), new Date(rental.start_date)) + 1);
  const hasPromo = !!rental.discount_amount && rental.discount_amount > 0 && !!rental.original_total_price;
  const originalPrice = hasPromo ? (rental.original_total_price ?? rental.total_price) : rental.total_price;

  const handleConfirmPayment = async () => {
    haptics.medium();
    setShowConfirmDialog(false);
    setIsProcessing(true);
    try {
      toast.info('Creating payment link...');

      const idempotencyKey = crypto.randomUUID();

      const { data, error, response: payResponse } = await supabase.functions.invoke('create-payment', {
        body: {
          rentalId: rental.id,
          itemId: rental.item_id,
          startDate: rental.start_date,
          endDate: rental.end_date,
          renterId: rental.renter_id,
          ownerId: rental.owner_id,
          totalPrice: rental.total_price,
          promoCodeId: rental.promo_code_id,
          discountAmount: rental.discount_amount,
          originalAmount: rental.original_total_price,
          idempotencyKey,
        }
      });

      if (error) {
        let msg = error.message;
if (payResponse) {
            try {
              const body = await payResponse.json();
              if (body?.error) msg = body.error;
            } catch { /* response body not available */ }
          }
        throw new Error(msg);
      }

      haptics.success();
      toast.success('Redirecting to payment...');

      if (isNative()) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.paymentUrl });
      } else {
        window.location.href = data.paymentUrl;
      }

    } catch (error: unknown) {
      haptics.error();
      toast.error(error instanceof Error ? error.message : 'Failed to create payment');
      console.error(error);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        className="w-full"
        size="lg"
        onClick={() => { haptics.light(); setShowConfirmDialog(true); }}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating Payment...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay Now - RM {rental.total_price}
          </>
        )}
      </Button>
      {hasActiveBill && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Bill expires in <span className="font-medium text-foreground">{formatRemaining(remainingMs)}</span></span>
        </div>
      )}
      {pendingExpiresAt && remainingMs <= 0 && (
        <div className="mt-2 text-xs text-destructive text-center">
          Previous bill expired — a new one will be generated.
        </div>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review your payment</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">{rental.item?.title}</span></p>
                <p>{new Date(rental.start_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} — {new Date(rental.end_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} · {rentalDays} {rentalDays === 1 ? 'day' : 'days'}</p>
              </div>

              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span>Rental total</span>
                  <span>RM {originalPrice.toFixed(2)}</span>
                </div>
                {hasPromo && (
                  <div className="flex justify-between text-success">
                    <span>Promo discount</span>
                    <span>-RM {Number(rental.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total payable now</span>
                  <span>RM {rental.total_price.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1.5">
                {Number(rental.item?.deposit_amount || 0) > 0 && (
                  <p>Security deposit: RM{Math.round(Number(rental.item!.deposit_amount!))} — collect at pickup, refunded upon safe return. Not charged here.</p>
                )}
                <p>Platform fee (10%) is deducted from the owner's payout, not from your payment.</p>
                <p>Refund policy: If you cancel before the rental starts, a refund may be available depending on the owner's cancellation policy.</p>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs text-primary space-y-1">
                <p className="font-medium">Secure payment via ToyyibPay</p>
                <p>You'll be redirected to ToyyibPay (a Malaysian payment gateway) to complete payment. Accepted methods: FPX (all banks) and credit/debit cards. Your payment is protected by escrow — funds are only released to the owner after the rental period.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment}>
              Proceed to Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
