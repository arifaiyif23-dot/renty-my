import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Eye, EyeOff, Gift, Home, Loader2 } from 'lucide-react';
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
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { redirectTo?: string; from?: { pathname: string; search?: string } } | null;
  const oauthRedirect = sessionStorage.getItem('renty_oauth_redirect');
  const redirectTo = locState?.redirectTo || (locState?.from ? locState.from.pathname + (locState.from.search || '') : undefined) || oauthRedirect || undefined;
  if (oauthRedirect) sessionStorage.removeItem('renty_oauth_redirect');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', fullName: '', confirmPassword: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [preferredRole, setPreferredRole] = useState<'renter' | 'vendor'>('renter');

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

      <div className="flex-1 flex items-center justify-center p-4 pb-mobile-nav scroll-pb-40">
        <GlassCard className="w-full max-w-md" padding="lg">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Welcome to RENTY</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in or create an account to continue</p>
          </div>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-xl gap-1">
              <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">Login</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">Sign Up</TabsTrigger>
            </TabsList>

            <div className="mt-4 mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base font-medium gap-2 rounded-xl"
                disabled={isLoading}
                onClick={async () => {
                  if (isLoading) return;
                  setIsLoading(true);
                  try {
                    if (redirectTo) sessionStorage.setItem('renty_oauth_redirect', redirectTo);
                    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth` } });
                  } catch {
                    toast.error('Google sign-in failed. Please try again.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                {isLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Continue with Google</>
                ) : (
                  <><svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg> Continue with Google</>
                )}
              </Button>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <TabsContent value="login">
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
              </form>
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
      </div>
    </div>
  );
}
