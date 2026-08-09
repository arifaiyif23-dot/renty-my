import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { checkRateLimit } from '@/utils/securityHelpers';

const emailSchema = z.string().email('Please enter a valid email address');

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = emailSchema.safeParse(email.trim().toLowerCase());
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    const withinLimit = await checkRateLimit('password_reset', 3, 60, result.data);
    if (!withinLimit) {
      toast.error('Too many reset attempts. Please try again later.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
        redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      setEmailSent(true);
      setResendIn(30);
      toast.success('Password reset link sent!');
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEmail('');
      setEmailSent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="link" className="px-0 h-auto font-normal text-muted-foreground">
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        
        {emailSent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Check your email</h3>
            <p className="text-muted-foreground text-sm mb-2">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {resendIn > 0
                ? <>Didn't receive it? You can resend in <strong>{resendIn}s</strong> — also check your spam / promotions folder.</>
                : "Didn't receive it? Check your spam / promotions folder, then try again."}
            </p>
            {resendIn === 0 && (
              <Button
                variant="outline"
                className="mb-2"
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/auth?reset=true`,
                    });
                    setResendIn(30);
                    toast.success('Password reset link sent!');
                  } catch {
                    toast.error('Failed to resend. Try again.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                Resend
              </Button>
            )}
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
