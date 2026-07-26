import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Receipt, Timer, MessageCircle, Calendar, Package, RotateCcw, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Separator } from '@/components/ui/separator';

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ amount: number; itemTitle: string } | null>(null);
  const status = searchParams.get('status_id');
  const orderId = searchParams.get('order_id');
  const billCode = searchParams.get('billcode');
  const transactionId = searchParams.get('transaction_id');
  const [redirectCountdown, setRedirectCountdown] = useState(15);

  useEffect(() => {
    if (user && status === '1' && orderId) {
      verifyPayment();
    } else {
      // No user, no orderId, or not a success status — stop loading immediately
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  useEffect(() => {
    if (loading || confirmed) return;
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
  }, [loading, confirmed, navigate]);

  const verifyPayment = async () => {
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
        toast.error(t('paymentSuccess.notFound'));
        setLoading(false);
        return;
      }

      if (data.status !== 'paid') {
        toast.error(t('paymentSuccess.notVerified'));
        setLoading(false);
        return;
      }

      setConfirmed(true);
      setPaymentInfo({
        amount: Number(data.total_amount),
        itemTitle: ((data.rental as { item: { title: string } })?.item?.title) || 'your rental',
      });
    } catch (e) {
      console.error('Payment success fetch error:', e);
      toast.error(t('paymentSuccess.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  // Require BOTH URL param success AND DB confirmation before showing success UI
  const showSuccess = status === '1' && confirmed;
  const showFailure = !loading && !showSuccess;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('paymentSuccess.loading')}</p>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <GlassCard className="max-w-md w-full text-center" padding="lg">
          <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('paymentSuccess.title')}</h1>
          {paymentInfo && (
            <p className="text-muted-foreground mb-1">
              RM {paymentInfo.amount.toFixed(2)} — {paymentInfo.itemTitle}
            </p>
          )}
          <p className="text-muted-foreground mb-4">
            {t('paymentSuccess.description')}
          </p>

          <Separator className="my-4" />
          <div className="text-left text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 font-medium text-foreground mb-2">
              <Receipt className="h-3.5 w-3.5" />
              {t('paymentSuccess.receipt')}
            </div>
            {orderId && (
              <div className="flex justify-between">
                <span>{t('paymentSuccess.reference')}</span>
                <span className="font-mono tabular-nums">{orderId.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
            {transactionId && (
              <div className="flex justify-between">
                <span>{t('paymentSuccess.transactionId')}</span>
                <span className="font-mono tabular-nums">{transactionId}</span>
              </div>
            )}
            {billCode && (
              <div className="flex justify-between">
                <span>{t('paymentSuccess.billCode')}</span>
                <span className="font-mono tabular-nums">{billCode}</span>
              </div>
            )}
          </div>
          <Separator className="my-4" />

          <div className="text-left">
            <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-success" />
              {t('paymentSuccess.checklistTitle')}
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageCircle className="h-3 w-3 text-primary" />
                </div>
                <span>{t('paymentSuccess.checklist1')}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="h-3 w-3 text-primary" />
                </div>
                <span>{t('paymentSuccess.checklist2')}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Package className="h-3 w-3 text-primary" />
                </div>
                <span>{t('paymentSuccess.checklist3')}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw className="h-3 w-3 text-primary" />
                </div>
                <span>{t('paymentSuccess.checklist4')}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Banknote className="h-3 w-3 text-primary" />
                </div>
                <span>{t('paymentSuccess.checklist5')}</span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <p className="text-xs text-muted-foreground mb-6">
            {t('paymentSuccess.refundPolicy')}
          </p>
          <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
            <Timer className="h-3 w-3" /> {t('paymentSuccess.notRedirected')}
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="default" className="w-full rounded-xl">
            {t('paymentSuccess.viewRentals')}
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (showFailure) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <GlassCard className="max-w-md w-full text-center" padding="lg">
          <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('paymentSuccess.failedTitle')}</h1>
          <p className="text-muted-foreground mb-2">
            {t('paymentSuccess.failedDescription')}
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            {t('paymentSuccess.failedHelp')}
          </p>
          {!user && (
            <p className="text-xs text-muted-foreground mb-4 flex items-center justify-center gap-1">
              <Timer className="h-3 w-3" /> {t('paymentSuccess.redirecting', { count: redirectCountdown })}
            </p>
          )}
          <Button onClick={() => navigate('/dashboard')} className="w-full rounded-xl">
            {user ? t('paymentSuccess.backToDashboard') : t('paymentSuccess.tryAgain')}
          </Button>
        </GlassCard>
      </div>
    );
  }

  // Fallback — should not reach here
  return null;
}
