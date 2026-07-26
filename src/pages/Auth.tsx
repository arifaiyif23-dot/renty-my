import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Eye, EyeOff, Gift, Home, Loader2, Shield, Users, Lock, CreditCard, Package, Camera, Wrench, Watch, Tent, Bike, Check } from 'lucide-react';
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
  fullName: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes')
    .transform(val => sanitizeText(val)),
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Must contain a special character'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { redirectTo?: string; from?: { pathname: string; search?: string } } | null;
  const oauthRedirect = sessionStorage.getItem('renty_oauth_redirect');
  const redirectTo = locState?.redirectTo || (locState?.from ? locState.from.pathname + (locState.from.search || '') : undefined) || oauthRedirect || undefined;
  if (oauthRedirect) sessionStorage.removeItem('renty_oauth_redirect');

  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Password recovery: the emailed link lands here with a recovery token. The
  // AuthContext dispatches 'renty:password-recovery'; also detect the hash directly.
  useEffect(() => {
    const onRecovery = () => setIsRecovery(true);
    window.addEventListener('renty:password-recovery', onRecovery);
    if (window.location.hash.includes('type=recovery')) setIsRecovery(true);
    return () => window.removeEventListener('renty:password-recovery', onRecovery);
  }, []);

  // Auto-redirect if already authenticated (handles OAuth callback landing)
  useEffect(() => {
    if (user && !isRecovery) {
      navigate(redirectTo || '/', { replace: true });
    }
  }, [user, navigate, redirectTo, isRecovery]);
  const [loginMethod, setLoginMethod] = useState<'magic_link' | 'password'>('magic_link');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', fullName: '', confirmPassword: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [preferredRole, setPreferredRole] = useState<'renter' | 'vendor'>('renter');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/[a-z]/, 'Must contain lowercase letter')
      .regex(/[0-9]/, 'Must contain a number');
    const parsed = schema.safeParse(newPassword);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated! You are now signed in.');
      setIsRecovery(false);
      // Clean the recovery hash from the URL.
      window.history.replaceState(null, '', window.location.pathname);
      navigate(redirectTo || '/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const error = result.error.errors[0];
      toast.error(error.message);
      return;
    }

    setIsLoading(true);
    try {
      const withinLimit = await checkRateLimit('login', 5, 15, loginData.email);
      if (!withinLimit) {
        toast.error('Too many login attempts. Please try again in 15 minutes.');
        return;
      }
      await signIn(result.data.email, result.data.password);

      // Enforce suspension at login: sign the user back out and block access.
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      if (signedInUser) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('is_suspended, suspension_reason')
          .eq('id', signedInUser.id)
          .maybeSingle();
        if (prof?.is_suspended) {
          await supabase.auth.signOut();
          toast.error(prof.suspension_reason
            ? `Your account has been suspended: ${prof.suspension_reason}`
            : 'Your account has been suspended. Please contact support.');
          return;
        }
      }

      toast.success('Welcome back!');
      navigate(redirectTo || '/');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';

      if (errorMessage.includes("Invalid login credentials")) {
        toast.error("Invalid email or password. Please try again.");
      } else if (errorMessage.includes("Email not confirmed")) {
        toast.error("Please check your email to confirm your account");
      } else if (errorMessage.includes("suspended") || errorMessage.includes("disabled")) {
        toast.error("Your account has been suspended. Please contact support.");
      } else {
        toast.error("Sign in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    const result = z.string().trim().email('Invalid email address').toLowerCase().safeParse(loginData.email);
    if (!result.success) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const withinLimit = await checkRateLimit('magic_link', 3, 15, result.data);
      if (!withinLimit) {
        toast.error('Too many requests. Please try again in 15 minutes.');
        return;
      }

      const { error: fnError } = await supabase.functions.invoke('send-magic-link', {
        body: { email: result.data },
      });
      if (fnError) throw fnError;

      setMagicLinkSent(true);
      toast.success('Magic link sent! Check your email.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Too many requests') || msg.includes('rate')) {
        toast.error('Please wait before requesting another link.');
      } else {
        toast.error('Failed to send magic link. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = signUpSchema.safeParse(signupData);
    if (!result.success) {
      const error = result.error.errors[0];
      toast.error(error.message);
      return;
    }

    if (!acceptedTerms) {
      toast.error('Sila terima Terma & Syarat dan Dasar Privasi untuk teruskan.');
      return;
    }

    setIsLoading(true);
    try {
      const withinLimit = await checkRateLimit('signup', 3, 60, signupData.email);
      if (!withinLimit) {
        toast.error('Too many signup attempts. Please try again later.');
        return;
      }
      await signUp(result.data.email, result.data.password, result.data.fullName, preferredRole);
      // Retry profile update a few times to handle trigger race condition
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              terms_accepted_at: new Date().toISOString(),
              terms_version: TERMS_VERSION,
            })
            .eq('id', newUser.id);
          if (!updateError) break;
          if (attempt < 4) await new Promise(r => setTimeout(r, 600));
        }
      }
      toast.success("Account created! Welcome to Renty!");
      navigate(preferredRole === 'vendor' ? "/vendor-onboarding" : (redirectTo || "/"));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';

      if (errorMessage.includes("User already registered")) {
        toast.error("This email is already registered. Try logging in instead.");
      } else if (errorMessage.includes("Password")) {
        toast.error("Password must be at least 8 characters with uppercase, lowercase, and number");
      } else if (errorMessage.includes("Invalid email")) {
        toast.error("Please enter a valid email address");
      } else {
        toast.error("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isRecovery) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md" padding="lg">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">Set a new password</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter and confirm your new password below.</p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 text-base rounded-xl"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm New Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="h-12 text-base rounded-xl"
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-medium rounded-xl" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Renty" className="h-7 md:h-8 w-auto" loading="lazy" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 lg:grid lg:grid-cols-2">
        {/* Left column — auth form */}
        <div className="flex items-center justify-center p-4 pb-mobile-nav scroll-pb-40">
          <div className="w-full max-w-md space-y-6">
            <GlassCard className="w-full" padding="lg">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">Welcome to RENTY</h1>
                <p className="text-sm text-muted-foreground mt-1">Sign in or create an account to continue</p>
              </div>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-xl gap-1">
                  <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">Login</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  {magicLinkSent ? (
                    <div className="text-center py-8 space-y-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Check your email</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          We sent a magic link to <strong>{loginData.email}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click the link in the email to sign in instantly.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={isLoading}
                          onClick={handleMagicLink}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Resend magic link
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => { setMagicLinkSent(false); setLoginMethod('password'); }}
                        >
                          Sign in with password instead
                        </Button>
                      </div>
                    </div>
                  ) : loginMethod === 'magic_link' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="your@email.com"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          className="h-12 text-base rounded-xl"
                          autoComplete="email"
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        className="w-full h-12 text-base font-medium rounded-xl gap-2"
                        disabled={isLoading}
                        onClick={handleMagicLink}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        {isLoading ? 'Sending...' : 'Send Magic Link'}
                      </Button>
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => setLoginMethod('password')}
                        >
                          Sign in with password
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="your@email.com"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          className="h-12 text-base rounded-xl"
                          autoComplete="email"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showLoginPassword ? "text" : "password"}
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            className="h-12 text-base pr-12 rounded-xl"
                            autoComplete="current-password"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-12 w-12 hover:bg-transparent"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                          >
                            {showLoginPassword ? (
                              <EyeOff className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Eye className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        <div className="flex justify-end">
                          <ForgotPasswordDialog />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 text-base font-medium rounded-xl" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                      </Button>
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => setLoginMethod('magic_link')}
                        >
                          Send magic link instead
                        </Button>
                      </div>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="signup">
                  <Alert className="mb-4 border-primary bg-primary/5 rounded-xl">
                    <Gift className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <strong>Welcome Offer!</strong> Use code <span className="font-bold">WELCOME50</span> for 50% off your first rental!
                    </AlertDescription>
                  </Alert>

                  <form onSubmit={handleSignup} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Saya nak…</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPreferredRole('renter')}
                          className={`h-16 rounded-xl border-2 text-left px-3 transition ${
                            preferredRole === 'renter'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-muted-foreground/40'
                          }`}
                        >
                          <div className="font-semibold text-sm">Sewa barang</div>
                          <div className="text-[11px] text-muted-foreground">Cari & tempah</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreferredRole('vendor')}
                          className={`h-16 rounded-xl border-2 text-left px-3 transition ${
                            preferredRole === 'vendor'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-muted-foreground/40'
                          }`}
                        >
                          <div className="font-semibold text-sm">Sewakan barang</div>
                          <div className="text-[11px] text-muted-foreground">Jadi vendor</div>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={signupData.fullName}
                        onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                        className="h-12 text-base rounded-xl"
                        autoComplete="name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        className="h-12 text-base rounded-xl"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          className="h-12 text-base pr-12 rounded-xl"
                          autoComplete="new-password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-12 w-12 hover:bg-transparent"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignupPassword ? (
                            <EyeOff className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Eye className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="text-sm font-medium">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-confirm"
                          type={showConfirmPassword ? "text" : "password"}
                          value={signupData.confirmPassword}
                          onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                          className="h-12 text-base pr-12 rounded-xl"
                          autoComplete="new-password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-12 w-12 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Eye className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 pt-1">
                      <Checkbox
                        id="signup-terms"
                        checked={acceptedTerms}
                        onCheckedChange={(v) => setAcceptedTerms(v === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="signup-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        Saya bersetuju dengan{' '}
                        <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2">
                          Terma & Syarat
                        </Link>{' '}
                        dan{' '}
                        <Link to="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                          Dasar Privasi
                        </Link>{' '}
                        Renty (termasuk pemprosesan data di bawah PDPA).
                      </Label>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-medium rounded-xl" disabled={isLoading || !acceptedTerms}>
                      {isLoading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </GlassCard>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">PDPA Compliant</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30">
                <Lock className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">10,000+ Users</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30">
                <CreditCard className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">FPX & DuitNow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — animated hero banner (hidden on mobile) */}
        <div className="hidden lg:flex relative bg-gradient-to-br from-[#0F2A5F] via-[#0F2A5F] to-[#2563EB] items-center justify-center overflow-hidden">
          {/* Floating decorative icons */}
          <div className="absolute top-[12%] left-[15%] opacity-15 animate-float" style={{ animationDelay: '0s' }}>
            <Package className="h-16 w-16 text-white" />
          </div>
          <div className="absolute top-[8%] right-[20%] opacity-15 animate-float" style={{ animationDelay: '1.2s' }}>
            <Camera className="h-12 w-12 text-white" />
          </div>
          <div className="absolute bottom-[22%] left-[10%] opacity-15 animate-float" style={{ animationDelay: '2.4s' }}>
            <Wrench className="h-14 w-14 text-white" />
          </div>
          <div className="absolute top-[45%] right-[12%] opacity-15 animate-float" style={{ animationDelay: '0.8s' }}>
            <Watch className="h-10 w-10 text-white" />
          </div>
          <div className="absolute top-[62%] left-[22%] opacity-15 animate-float" style={{ animationDelay: '3s' }}>
            <Tent className="h-12 w-12 text-white" />
          </div>
          <div className="absolute bottom-[15%] right-[15%] opacity-15 animate-float" style={{ animationDelay: '1.8s' }}>
            <Bike className="h-14 w-14 text-white" />
          </div>

          {/* Gradient overlay at bottom for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F2A5F]/60 via-transparent to-[#0F2A5F]/10 pointer-events-none" />

          {/* Center content */}
          <div className="relative z-10 text-center px-12 max-w-lg">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight mb-4">
              Sewa Barang.
              <br />
              <span className="text-sky-300">Jimat Duit.</span>
            </h1>
            <p className="text-lg text-white/70 mb-8">
              Platform sewaan barang No.1 Malaysia
            </p>
            <div className="flex flex-col gap-3 items-center">
              {[
                '10,000+ Pengguna Aktif',
                'Pembayaran Selamat & Mudah',
                'Penghantaran Seluruh Malaysia',
              ].map((text) => (
                <div key={text} className="flex items-center gap-2 text-white/80">
                  <Check className="h-4 w-4 text-sky-300 shrink-0" />
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
