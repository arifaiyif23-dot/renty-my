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
import { haptics } from '@/utils/haptics';

interface PayNowButtonProps {
  rental: Rental;
  onPaymentCreated?: () => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PayNowButton({ rental, onPaymentCreated }: PayNowButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingExpiresAt, setPendingExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Look for an existing pending payment for this rental to show countdown
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
      .catch(() => {});
    return () => { active = false; };
  }, [rental.id]);

  // Tick every second while countdown is visible
  useEffect(() => {
    if (!pendingExpiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pendingExpiresAt]);

  const remainingMs = pendingExpiresAt ? new Date(pendingExpiresAt).getTime() - now : 0;
  const hasActiveBill = !!pendingExpiresAt && remainingMs > 0;

  const handleConfirmPayment = async () => {
    haptics.medium();
    setShowConfirmDialog(false);
    setIsProcessing(true);
    try {
      toast.info('Creating payment link...');

      // Call create-payment edge function with the approved rental
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          rentalId: rental.id, // Use existing rental ID
          itemId: rental.item_id,
          startDate: rental.start_date,
          endDate: rental.end_date,
          renterId: rental.renter_id,
          ownerId: rental.owner_id,
          totalPrice: rental.total_price
        }
      });

      if (error) throw error;

      haptics.success();
      toast.success('Redirecting to payment...');
      
      // Redirect to ToyyibPay
      window.location.href = data.paymentUrl;

    } catch (error: any) {
      haptics.error();
      toast.error(error.message || 'Failed to create payment');
      console.error(error);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
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
            <AlertDialogTitle>Ready to pay for this rental?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-foreground">Amount:</span>
                  <span className="font-semibold text-foreground">RM {rental.total_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Item:</span>
                  <span className="font-medium text-foreground">{rental.item?.title}</span>
                </div>
              </div>
              <p className="text-sm">You'll be redirected to ToyyibPay to complete payment securely.</p>
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