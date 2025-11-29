import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
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

interface PayNowButtonProps {
  rental: Rental;
  onPaymentCreated?: () => void;
}

export function PayNowButton({ rental, onPaymentCreated }: PayNowButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleConfirmPayment = async () => {
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

      toast.success('Redirecting to payment...');
      
      // Redirect to ToyyibPay
      window.location.href = data.paymentUrl;

    } catch (error: any) {
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
        onClick={() => setShowConfirmDialog(true)}
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