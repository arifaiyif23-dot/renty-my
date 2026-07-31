import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ amount: number; itemTitle: string } | null>(null);
  const status = searchParams.get('status_id');
  const orderId = searchParams.get('order_id');
  const billCode = searchParams.get('billcode');

  useEffect(() => {
    if (user && status === '1' && orderId) {
      verifyPayment();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  useEffect(() => {
    if (loading || confirmed) return;
    const timer = setTimeout(() => navigate('/dashboard'), 3000);
    return () => clearTimeout(timer);
  }, [loading, confirmed, navigate]);

  const verifyPayment = async () => {
    if (!orderId) { setLoading(false); return; }

    if (billCode) {
      const { data: verifyData } = await supabase.functions.invoke('verify-payment', {
        body: { billCode, paymentId: orderId }
      });
      if (verifyData?.verified) { setConfirmed(true); setLoading(false); return; }
    }

    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: pollData } = await supabase
        .from('payments')
        .select('status, total_amount, rental:rentals!rental_id!inner(item:items(title))')
        .eq('id', orderId)
        .maybeSingle();

      if (pollData?.status === 'paid') {
        clearInterval(poll);
        setConfirmed(true);
        setPaymentInfo({
          amount: Number(pollData.total_amount),
          itemTitle: ((pollData.rental as { item: { title: string } })?.item?.title) || 'your rental',
        });
        setLoading(false);
        return;
      }
      if (attempts >= 10) { clearInterval(poll); setLoading(false); }
    }, 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Verifying payment...</p>
        </div>
      </div>
    );
  }

  const showSuccess = status === '1' && confirmed;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="card-base p-8 max-w-sm w-full text-center">
        {showSuccess ? (
          <>
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-1">Payment confirmed!</h1>
            {paymentInfo && (
              <p className="text-sm text-muted-foreground mb-1">
                RM {paymentInfo.amount.toFixed(2)} — {paymentInfo.itemTitle}
              </p>
            )}
            <p className="text-xs text-muted-foreground mb-6">Check your dashboard for rental details.</p>
            <Button onClick={() => navigate('/dashboard')} className="w-full rounded-lg">
              View My Rentals
            </Button>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-1">Payment not confirmed</h1>
            <p className="text-sm text-muted-foreground mb-6">Please try again or contact support.</p>
            <Button onClick={() => navigate('/dashboard')} className="w-full rounded-lg">
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
