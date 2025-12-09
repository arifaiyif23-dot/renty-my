import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface VerificationRequiredBannerProps {
  isVerified: boolean;
}

export function VerificationRequiredBanner({ isVerified }: VerificationRequiredBannerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (isVerified) {
    return (
      <Alert className="mb-4 border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-700 dark:text-green-400">
          {t('verification.verified', 'Verified Account')}
        </AlertTitle>
        <AlertDescription className="text-green-600 dark:text-green-300">
          {t('verification.verifiedDesc', 'Your identity is verified. You can list items for rent.')}
        </AlertDescription>
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
