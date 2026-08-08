import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Home } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { z } from 'zod';
import { sanitizeText } from '@/utils/sanitize';
import { checkRateLimit } from '@/utils/securityHelpers';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { supabase } from '@/integrations/supabase/client';

const TERMS_VERSION = '2026-07-01';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password required')
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).regex(/^[a-zA-Z\s'-]+$/).transform(val => sanitizeText(val)),
  email: z.string().trim().email('Invalid email address').max(255).toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).regex(/[A-Z]/, 'Must contain uppercase letter').regex(/[a-z]/, 'Must contain lowercase letter').regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { redirectTo?: string; from?: { pathname: string; search?: string } } | null;
  const oauthRedirect = sessionStorage.getItem('renty_oauth_redirect');
  const redirectTo = locState?.redirectTo || (locState?.from ? locState.from.pathname + (locState.from.search || '') : undefined) || oauthRedirect || undefined;
  if (oauthRedirect) sessionStorage.removeItem('renty_oauth_redirect');

  const [isRecovery, setIsRecovery] = useState(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    return hash.includes('type=recovery') || search.includes('reset=true');
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    const onRecovery = () => setIsRecovery(true);
    window.addEventListener('renty:password-recovery', onRecovery);
    return () => window.removeEventListener('renty:password-recovery', onRecovery);
  }, []);

  useEffect(() => {
    if (user && !isRecovery && !signedUpRef.current) {
      navigate(redirectTo || '/', { replace: true });
    }
  }, [user, navigate, redirectTo, isRecovery]);

  const [loginMethod, setLoginMethod] = useState<'magic_link' | 'password'>('password');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', fullName: '', confirmPassword: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const signedUpRef = useRef(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase letter').regex(/[a-z]/, 'Must contain lowercase letter').regex(/[0-9]/, 'Must contain a number');
    const parsed = schema.safeParse(newPassword);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (newPassword !== confirmNewPassword) { toast.error('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated!');
      setIsRecovery(false);
      window.history.replaceState(null, '', window.location.pathname);
      navigate(redirectTo || '/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password.');
    } finally { setIsLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(loginData);
    if (!result.success) { toast.error(result.error.errors[0].message); return; }
    setIsLoading(true);
    try {
      const withinLimit = await checkRateLimit('login', 5, 15, loginData.email);
      if (!withinLimit) { toast.error('Too many attempts. Try again in 15 minutes.'); return; }
      await signIn(result.data.email, result.data.password);
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      if (signedInUser) {
        const { data: prof } = await supabase.from('profiles').select('is_suspended, suspension_reason').eq('id', signedInUser.id).maybeSingle();
        if (prof?.is_suspended) {
          await supabase.auth.signOut();
          toast.error(prof.suspension_reason ? `Account suspended: ${prof.suspension_reason}` : 'Account suspended. Contact support.');
          return;
        }
      }
      toast.success('Welcome back!');
      navigate(redirectTo || '/');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Invalid login credentials')) toast.error('Invalid email or password.');
      else if (msg.includes('Email not confirmed')) toast.error('Please confirm your email first.');
      else toast.error('Sign in failed. Try again.');
    } finally { setIsLoading(false); }
  };

  const handleMagicLink = async () => {
    const result = z.string().trim().email('Invalid email address').toLowerCase().safeParse(loginData.email);
    if (!result.success) { toast.error('Enter a valid email'); return; }
    setIsLoading(true);
    try {
      const withinLimit = await checkRateLimit('magic_link', 3, 15, result.data);
      if (!withinLimit) { toast.error('Too many requests. Try again later.'); return; }
      const { error: fnError } = await supabase.functions.invoke('send-magic-link', { body: { email: result.data } });
      if (fnError) throw fnError;
      setMagicLinkSent(true);
      toast.success('Magic link sent! Check your email.');
    } catch { toast.error('Failed to send magic link.'); }
    finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signUpSchema.safeParse(signupData);
    if (!result.success) { toast.error(result.error.errors[0].message); return; }
    if (!acceptedTerms) { toast.error('Please accept the terms to continue.'); return; }
    setIsLoading(true);
    try {
      const withinLimit = await checkRateLimit('signup', 3, 60, signupData.email);
      if (!withinLimit) { toast.error('Too many signup attempts.'); return; }
      const { userId, autoLoggedIn } = await signUp(result.data.email, result.data.password, result.data.fullName, 'renter');

      if (userId) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const { error: updateError } = await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }).eq('id', userId);
          if (!updateError) break;
          if (attempt < 4) await new Promise(r => setTimeout(r, 600));
        }
      }

      if (autoLoggedIn) {
        signedUpRef.current = true;
        toast.success('Account created! Welcome to Renty!');
        navigate(redirectTo || '/');
      } else {
        setSignupEmail(result.data.email);
        setShowConfirmEmail(true);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('User already registered')) toast.error('Email already registered. Try logging in.');
      else toast.error('Failed to create account.');
    } finally { setIsLoading(false); }
  };

  if (isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="rounded-2xl border border-border bg-card shadow-2 p-6 md:p-8 w-full max-w-md text-center">
          <h1 className="text-xl font-bold mb-1">Set new password</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter and confirm your new password.</p>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 rounded-lg" autoComplete="new-password" required />
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="confirm-new-password">Confirm Password</Label>
              <Input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="h-12 rounded-lg" autoComplete="new-password" required />
            </div>
            <Button type="submit" className="w-full h-12 rounded-lg" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-50 w-full border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto px-4 max-w-5xl h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo-light.png" alt="Renty" className="h-7 w-auto" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-lg">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 lg:grid lg:grid-cols-2">
        <div className="relative flex items-start justify-center p-4 pb-mobile-nav overflow-y-auto">
          <div className="relative w-full max-w-sm space-y-6 my-auto">
            <div className="rounded-2xl border border-border bg-card shadow-2 p-6 md:p-8">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground mt-1.5">Sign in to continue</p>
              </div>
              <Tabs defaultValue="login">
                <TabsList className="grid w-full grid-cols-2 bg-muted p-0.5 rounded-lg gap-0.5">
                  <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-1 text-sm">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-1 text-sm">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  {magicLinkSent ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-sm">Check your email for a magic link.</p>
                      <p className="text-xs text-muted-foreground">Sent to <strong>{loginData.email}</strong></p>
                      <Button variant="outline" size="sm" disabled={isLoading} onClick={handleMagicLink}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Resend
                      </Button>
                      <Button variant="link" size="sm" onClick={() => { setMagicLinkSent(false); setLoginMethod('password'); }}>
                        Sign in with password
                      </Button>
                    </div>
                  ) : loginMethod === 'magic_link' ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="login-email-ml">Email</Label>
                        <Input id="login-email-ml" type="email" placeholder="your@email.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} className="h-12 rounded-lg" required />
                      </div>
                      <Button className="w-full h-12 rounded-lg gap-2" disabled={isLoading} onClick={handleMagicLink}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                        {isLoading ? 'Sending...' : 'Send Magic Link'}
                      </Button>
                      <div className="text-center">
                        <Button type="button" variant="link" size="sm" onClick={() => setLoginMethod('password')}>Sign in with password</Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="login-email">Email</Label>
                        <Input id="login-email" type="email" placeholder="your@email.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} className="h-12 rounded-lg" required />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password">Password</Label>
                          <ForgotPasswordDialog />
                        </div>
                        <div className="relative">
                          <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} className="h-12 rounded-lg pr-12" required />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-12 w-12" onClick={() => setShowLoginPassword(!showLoginPassword)} aria-label={showLoginPassword ? 'Hide password' : 'Show password'}>
                            {showLoginPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 rounded-lg" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                      </Button>
                      <div className="text-center">
                        <Button type="button" variant="link" size="sm" onClick={() => setLoginMethod('magic_link')}>Send magic link instead</Button>
                      </div>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="signup">
                  {showConfirmEmail ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-sm">Check your email to confirm your account.</p>
                      <p className="text-xs text-muted-foreground">Sent to <strong>{signupEmail}</strong></p>
                      <Button variant="link" size="sm" onClick={() => setShowConfirmEmail(false)}>Back to sign up</Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input id="signup-name" type="text" placeholder="John Doe" value={signupData.fullName} onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })} className="h-12 rounded-lg" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input id="signup-email" type="email" placeholder="your@email.com" value={signupData.email} onChange={(e) => setSignupData({ ...signupData, email: e.target.value })} className="h-12 rounded-lg" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Input id="signup-password" type={showSignupPassword ? 'text' : 'password'} value={signupData.password} onChange={(e) => setSignupData({ ...signupData, password: e.target.value })} className="h-12 rounded-lg pr-12" required />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-12 w-12" onClick={() => setShowSignupPassword(!showSignupPassword)} aria-label={showSignupPassword ? 'Hide password' : 'Show password'}>
                            {showSignupPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-confirm">Confirm Password</Label>
                        <div className="relative">
                          <Input id="signup-confirm" type={showConfirmPassword ? 'text' : 'password'} value={signupData.confirmPassword} onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })} className="h-12 rounded-lg pr-12" required />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-12 w-12" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                            {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                      <label className="flex items-start gap-2 min-h-[44px] cursor-pointer">
                        <Checkbox id="signup-terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} className="mt-0.5" />
                        <Label htmlFor="signup-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                          I accept the{' '}
                          <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2">Terms</Link> and{' '}
                          <Link to="/privacy" target="_blank" className="text-primary underline underline-offset-2">Privacy Policy</Link>
                        </Label>
                      </label>
                      <Button type="submit" className="w-full h-12 rounded-lg" disabled={isLoading || !acceptedTerms}>
                        {isLoading ? 'Creating account...' : 'Create Account'}
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="text-center px-3 py-2.5 rounded-lg bg-muted/30"><span className="text-xs text-muted-foreground">PDPA Compliant</span></div>
              <div className="text-center px-3 py-2.5 rounded-lg bg-muted/30"><span className="text-xs text-muted-foreground">256-bit Encryption</span></div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex relative bg-gradient-to-br from-primary via-brand to-primary items-center justify-center overflow-hidden">
          <div className="relative z-10 text-center px-12 max-w-md">
            <h1 className="text-3xl font-semibold text-white leading-[1.1] mb-3 tracking-tight">
              Rent Smart. Earn More.
            </h1>
            <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
              Malaysia's peer-to-peer rental marketplace — list your items or discover what others offer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
