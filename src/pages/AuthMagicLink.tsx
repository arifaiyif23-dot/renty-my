import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';

export default function AuthMagicLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      setStatus('error');
      setErrorMsg('Invalid link');
      return;
    }

    supabase.functions.invoke('verify-magic-link', {
      body: { token, email },
    }).then(async ({ data, error }) => {
      if (error || !data?.access_token) {
        setStatus('error');
        setErrorMsg(error?.message || 'Link expired or invalid');
        return;
      }

      // Check the result of setSession — it resolves with { error } on failure
      // instead of throwing, so we must inspect it explicitly.
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;

      setStatus('success');
      // Restore the originally-intended destination (set before the magic-link
      // request) instead of always landing on '/'.
      const intended = sessionStorage.getItem('renty_auth_redirect') || '/';
      sessionStorage.removeItem('renty_auth_redirect');
      setTimeout(() => navigate(intended, { replace: true }), 1500);
    }).catch(() => {
      setStatus('error');
      setErrorMsg('Something went wrong');
    });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <GlassCard className="w-full max-w-sm text-center" padding="lg">
        {status === 'loading' && (
          <div className="py-8 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Signing you in...</p>
          </div>
        )}
        {status === 'success' && (
          <div className="py-8 space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-semibold text-lg">Signed in!</p>
            <p className="text-sm text-muted-foreground">Redirecting to homepage...</p>
          </div>
        )}
        {status === 'error' && (
          <div className="py-8 space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <p className="font-semibold text-lg">Link expired</p>
            <p className="text-sm text-muted-foreground">{errorMsg}. Please request a new link.</p>
            <Button onClick={() => navigate('/auth')} className="rounded-xl">
              Back to login
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
