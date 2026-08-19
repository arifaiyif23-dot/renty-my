import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Loader2, ExternalLink, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isNative } from '@/lib/platform';
import { safeHttpUrl } from '@/utils/sanitize';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ResumePaymentButtonProps {
  rental: Rental;
}

export function ResumePaymentButton({ rental }: ResumePaymentButtonProps) {
  const { t } = useTranslation();
  const [billUrl, setBillUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('payments')
      .select('toyyibpay_bill_url, expires_at')
      .eq('rental_id', rental.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.toyyibpay_bill_url) {
          setBillUrl(data.toyyibpay_bill_url);
          setExpiresAt(data.expires_at);
        }
      })
      .catch((err) => console.error('Failed to load pending bill:', err));
    return () => { active = false; };
  }, [rental.id]);

  useEffect(() => {
    if (!expiresAt) return;
    const tId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tId);
  }, [expiresAt]);

  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  if (!billUrl || remainingMs <= 0) return null;

  const handleResume = async () => {
    setOpening(true);
    const url = safeHttpUrl(billUrl);
    if (!url) {
      setOpening(false);
      return;
    }
    if (isNative()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } else {
      window.open(url, '_blank', 'noopener');
    }
    setOpening(false);
  };

  return (
    <div className="space-y-2">
      <Button
        variant="default"
        className="w-full h-12"
        onClick={handleResume}
        disabled={opening}
      >
        {opening ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-2" />
        )}
        {t('rental.resumePayment')}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{t('rental.paymentExpiresIn', { time: formatRemaining(remainingMs) })}</span>
      </p>
    </div>
  );
}