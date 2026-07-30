import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Camera, CheckCircle } from 'lucide-react';
import { Rental } from '@/types';

interface HandoverDialogProps {
  rental: Rental;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function HandoverDialog({ rental, open, onOpenChange, onSuccess }: HandoverDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'upload' | 'verify'>('upload');
  const [, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [enteredCode, setEnteredCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = () => {
    setStep('upload');
    setPhotos([]);
    setPhotoUrls([]);
    setEnteredCode('');
    setIsProcessing(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPhotos(prev => [...prev, ...files]);

    // Upload to storage
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const fileName = `${rental.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('rental-evidence')
        .upload(fileName, file);

      if (error) {
        toast.error(t('handover.uploadFailed'));
        console.error(error);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('rental-evidence')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    setPhotoUrls(prev => [...prev, ...uploadedUrls]);
    toast.success(t('handover.photosUploaded', { count: files.length }));
  };

  const handleVerifyCode = async () => {
    if (enteredCode !== rental.pickup_code) {
      toast.error(t('handover.invalidCode'));
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('confirm-handover', {
        body: {
          action: 'confirm',
          rentalId: rental.id,
          handoverPhotos: photoUrls,
          pickupCode: enteredCode,
        }
      });

      if (error) throw error;

      toast.success(t('handover.rentalStarted'));
      onSuccess();
      handleOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('handover.failedToStart'));
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceedToVerify = photoUrls.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('handover.title')}</DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? t('handover.uploadDesc')
              : t('handover.codeDesc')}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                id="handover-photos"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <label htmlFor="handover-photos" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{t('handover.uploadPhotos')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('handover.minPhotos')}
                </p>
              </label>
            </div>

            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt={`Evidence ${idx + 1}`} className="object-cover w-full h-full" loading="lazy" />
                    <div className="absolute top-1 right-1 bg-success rounded-full p-1">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <Camera className="h-5 w-5 text-primary" />
              <p className="text-sm text-primary">
                {t('handover.photosCount', { count: photoUrls.length })}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label htmlFor="pickup-code">{t('handover.codeLabel')}</Label>
              <Input
                id="pickup-code"
                type="text"
                maxLength={4}
                placeholder={t('handover.codePlaceholder')}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl font-mono mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('handover.codeHint')}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('common.cancel')}
          </Button>
          {step === 'upload' ? (
            <Button
              variant="default"
              onClick={() => setStep('verify')}
              disabled={!canProceedToVerify}
              className="w-full sm:w-auto"
            >
              {t('handover.nextVerify')}
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={handleVerifyCode}
              disabled={enteredCode.length !== 4 || isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? t('handover.starting') : t('handover.startRental')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}