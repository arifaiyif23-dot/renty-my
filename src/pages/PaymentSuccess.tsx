import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Receipt, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Separator } from '@/components/ui/separator';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<{ amount: number; itemTitle: string } | null>(null);
  const status = searchParams.get('status_id');
  const orderId = searchParams.get('order_id');
  const billCode = searchParams.get('billcode');
  const transactionId = searchParams.get('transaction_id');
  const [redirectCountdown, setRedirectCountdown] = useState(15);

  useEffect(() => {
    if (!user || status !== '1') {
      setLoading(false);
      return;
    }
    fetchLatestPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  useEffect(() => {
    if (loading || paymentInfo) return;
    const interval = setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          navigate('/dashboard');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, paymentInfo, navigate]);

  const fetchLatestPayment = async () => {
    try {
      if (!orderId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('payments')
        .select('status, total_amount, rental:rentals!rental_id!inner(item:items(title))')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Payment record not found. Please contact support.');
        setLoading(false);
        return;
      }

      if (data.status !== 'paid') {
        toast.error('Payment could not be verified. Please contact support.');
        setLoading(false);
        return;
      }

      setPaymentInfo({
        amount: Number(data.total_amount),
        itemTitle: ((data.rental as { item: { title: string } })?.item?.title) || 'your rental',
      });
    } catch (e) {
      console.error('Payment success fetch error:', e);
      toast.error('Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (status === '1') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <GlassCard className="max-w-md w-full text-center" padding="lg">
          <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          {paymentInfo && (
            <p className="text-muted-foreground mb-1">
              RM {paymentInfo.amount.toFixed(2)} — {paymentInfo.itemTitle}
            </p>
          )}
          <p className="text-muted-foreground mb-4">
            Your rental has been confirmed. The owner will prepare the item for you.
          </p>

          <Separator className="my-4" />
          <div className="text-left text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 font-medium text-foreground mb-2">
              <Receipt className="h-3.5 w-3.5" />
              Receipt
            </div>
            {orderId && (
              <div className="flex justify-between">
                <span>Reference</span>
                <span className="font-mono tabular-nums">{orderId.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
            {transactionId && (
              <div className="flex justify-between">
                <span>Transaction ID</span>
                <span className="font-mono tabular-nums">{transactionId}</span>
              </div>
            )}
            {billCode && (
              <div className="flex justify-between">
                <span>Bill Code</span>
                <span className="font-mono tabular-nums">{billCode}</span>
              </div>
            )}
          </div>
          <Separator className="my-4" />

          <p className="text-xs text-muted-foreground mb-6">
            Refund policy: Cancellation refunds depend on the owner's cancellation policy. Check your rental details for specifics.
          </p>
          <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
            <Timer className="h-3 w-3" /> Not redirected? Click below.
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="default" className="w-full rounded-xl">
            View My Rentals
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <GlassCard className="max-w-md w-full text-center" padding="lg">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
        <p className="text-muted-foreground mb-2">
          Your payment could not be processed. Please try again.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Ensure your card/FPX has sufficient funds and try again. No amount has been charged.
        </p>
        {!user && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center justify-center gap-1">
            <Timer className="h-3 w-3" /> Redirecting to dashboard in {redirectCountdown}s
          </p>
        )}
        <Button onClick={() => navigate('/dashboard')} className="w-full rounded-xl">
          {user ? 'Back to Dashboard' : 'Try Again'}
        </Button>
      </GlassCard>
    </div>
  );
}
