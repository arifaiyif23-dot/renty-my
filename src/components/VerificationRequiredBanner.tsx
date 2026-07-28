import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useState } from 'react';

interface VerificationRequiredBannerProps {
  isVerified: boolean;
}

const BANNER_SEEN_KEY = 'renty_verified_banner_seen';

export function VerificationRequiredBanner({ isVerified }: VerificationRequiredBannerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isVerified && !dismissed) {
      const seen = localStorage.getItem(BANNER_SEEN_KEY);
      if (seen) setDismissed(true);
    }
  }, [isVerified, dismissed]);

  if (isVerified && !dismissed) {
    return (
      <Alert className="mb-4 border-success/50 bg-success/10 relative">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">
          {t('verification.verified', 'Verified Account')}
        </AlertTitle>
        <AlertDescription className="text-success">
          {t('verification.verifiedDesc', 'Your identity is verified. You can list items for rent.')}
        </AlertDescription>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(BANNER_SEEN_KEY, '1');
          }}
          className="absolute top-2 right-2 p-1 rounded-md hover:bg-success/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>{t('verification.required', 'Verification Required')}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          {t('verification.requiredDesc', 'You must verify your identity (MyKad/Passport) before listing items. This helps keep our platform safe and trustworthy.')}
        </p>
        <Button 
          onClick={() => navigate('/verification')}
          size="sm"
          className="gap-2"
        >
          {t('verification.verifyNow', 'Verify Now')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
