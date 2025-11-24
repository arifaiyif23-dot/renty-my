import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
import { Rental } from '@/types';

interface PayNowButtonProps {
  rental: Rental;
  onPaymentCreated?: () => void;
}

export function PayNowButton({ rental, onPaymentCreated }: PayNowButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = async () => {
    setIsProcessing(true);
    try {
      const confirmed = window.confirm(
        `Ready to pay for this rental?\n\n` +
        `Amount: RM ${rental.total_price}\n` +
        `Item: ${rental.item?.title}\n\n` +
        `You'll be redirected to ToyyibPay to complete payment.`
      );

      if (!confirmed) {
        setIsProcessing(false);
        return;
      }

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
    <Button
      className="w-full"
      size="lg"
      onClick={handlePayNow}
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
  );
}