import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Calendar, Star, Package, ShoppingBag, Edit, ShieldCheck, ShieldAlert, ListChecks, RefreshCw, Trash2, Bell, Search, HelpCircle, Loader2, Clock, MessageCircle, CircleAlert } from "lucide-react";
import { UserTrustBadge, TrustScoreRing } from "@/components/trust/UserTrustBadge";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { ReferralSystem } from "@/components/ReferralSystem";
import Header from "@/components/Header";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import ProfileSkeleton from "@/components/ProfileSkeleton";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useProfileStatsQuery, useVerificationStatusQuery } from "@/hooks/use-profile-query";
import { useAdminCheck } from "@/hooks/use-admin-check";
import { useActiveStatus } from "@/hooks/use-active-status";
import { getSrcSet } from "@/utils/imageOptimization";

export default function Profile() {
  const { user, profile, error: authError } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { data: isAdmin } = useAdminCheck(user?.id);
  const isMobile = useIsMobile();
  useActiveStatus(user?.id);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useProfileStatsQuery(user?.id);
  const { data: verificationStatus, refetch: refetchVerification } = useVerificationStatusQuery(user?.id);

  const refreshProfile = async () => {
    await Promise.all([refetchStats(), refetchVerification()]);
  };

  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await refreshProfile();
    toast.success('Profile updated');
  }, isMobile);

  if (authError && !profile) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav">
          <GlassCard variant="subtle" padding="lg" className="text-center py-12">
            <CircleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to load profile</h2>
            <p className="text-muted-foreground mb-4">{authError}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </GlassCard>
        </div>
      </>
    );
  }

  if (statsLoading || !profile) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav">
          <ProfileSkeleton />
        </div>
      </>
    );
  }

  const initials = (profile.full_name || '')
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav">
        {pullDistance > 0 && (
          <div className="flex justify-center py-2">
            <RefreshCw className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
          </div>
        )}

        {!profile.is_verified && !verificationStatus && (
          <GlassCard variant="interactive" padding="lg" className="mb-6 border-primary/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Verify Your Identity</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Get verified to unlock premium rentals, build trust with the community, and increase your visibility.
                </p>
                <Button size="sm" onClick={() => navigate('/verification')}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Start Verification
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        {verificationStatus && verificationStatus.status === 'pending' && (
          <GlassCard variant="subtle" padding="lg" className="mb-6 border-warning/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Verification Under Review</h3>
                <p className="text-sm text-muted-foreground">
                  Your verification is being reviewed by our team. We'll notify you within 24-48 hours.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {verificationStatus && verificationStatus.status === 'rejected' && (
          <GlassCard variant="subtle" padding="lg" className="mb-6 border-destructive/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Verification Rejected</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Your verification was rejected. Please review your documents and try again.
                </p>
                <Button size="sm" variant="destructive" onClick={() => navigate('/verification')}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        <GlassCard variant="subtle" padding="lg" className="mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-2 ring-border">
              <AvatarImage src={profile.avatar_url} srcSet={getSrcSet(profile.avatar_url || '')} sizes="96px" alt={profile.full_name} />
              <AvatarFallback className="text-2xl rounded-full">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                <UserTrustBadge
                  level={profile.verification_level}
                  trustScore={profile.trust_score}
                  size="md"
                />
              </div>

              {profile.location && (
                <p className="text-muted-foreground flex items-center gap-1 mb-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(profile.created_at), "MMMM yyyy")}
                </span>
                {profile.last_active_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Date.now() - new Date(profile.last_active_at).getTime() < 2 * 60 * 1000
                      ? "Active now"
                      : `Active ${formatDistanceToNow(new Date(profile.last_active_at), { addSuffix: false })} ago`}
                  </span>
                )}
                {profile.response_rate != null && profile.avg_response_time_minutes != null && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    Responds {profile.avg_response_time_minutes < 1
                      ? "within < 1 min"
                      : profile.avg_response_time_minutes < 60
                        ? `within ${Math.round(profile.avg_response_time_minutes)} min`
                        : `within ${Math.round(profile.avg_response_time_minutes / 60)} hr`}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-4 flex-wrap">
                <Button size="sm" onClick={() => setEditDialogOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('profile.editProfile')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/my-listings')}>
                  <ListChecks className="h-4 w-4 mr-2" />
                  {t('profile.manageListing')}
                </Button>
                {isAdmin?.isAdmin && (
                  <Link to="/admin">
                    <Button size="sm" variant="secondary">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Admin Dashboard
                    </Button>
                  </Link>
                )}
                <Link to="/dashboard">
                  <Button size="sm" variant="outline">Dashboard</Button>
                </Link>
                <Link to="/earnings">
                  <Button size="sm" variant="outline">My Earnings</Button>
                </Link>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <GlassCard variant="subtle" padding="lg" className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Items Listed</p>
              <p className="text-3xl font-bold tabular-nums">{stats?.itemsListed || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">As Owner</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="lg" className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Rentals Given</p>
              <p className="text-3xl font-bold tabular-nums">{stats?.rentalsAsOwner || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">As Owner</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-success" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="lg" className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Rentals</p>
              <p className="text-3xl font-bold tabular-nums">{stats?.rentalsAsRenter || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">As Renter</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="lg" className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Average Rating</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tabular-nums text-primary">
                  {stats && stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">({stats?.totalReviews || 0})</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
              <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="lg" className="md:col-span-2 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Trust Score</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tabular-nums" style={{ color: (profile.trust_score ?? 0) >= 80 ? 'hsl(var(--success))' : (profile.trust_score ?? 0) >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>
                  {profile.trust_score ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">/100</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {profile.total_rentals_completed || 0} rentals completed
              </p>
              {profile.response_rate != null && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {Math.round(profile.response_rate)}% response rate
                  {profile.avg_response_time_minutes != null && (
                    <span className="ml-1">
                      · {profile.avg_response_time_minutes < 1 ? "<1m" : profile.avg_response_time_minutes < 60 ? `<${Math.round(profile.avg_response_time_minutes)}m` : `<${Math.round(profile.avg_response_time_minutes / 60)}h`}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <TrustScoreRing score={profile.trust_score ?? 0} size={56} />
            </div>
          </GlassCard>

          <details className="group text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1 select-none">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>
              How trust score is calculated
            </summary>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-success" /> Verified ID
                </span>
                <span className={profile.verification_level && profile.verification_level !== 'unverified' ? 'text-success font-medium' : ''}>
                  {profile.verification_level && profile.verification_level !== 'unverified' ? '+20' : '+0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-primary" /> Completed Rentals
                </span>
                <span className="font-medium">{Math.min(profile.total_rentals_completed || 0, 30)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" /> Reviews Received
                </span>
                <span className="font-medium">{Math.min(profile.total_reviews_received || 0, 20)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <CircleAlert className="h-3 w-3 text-primary" /> Profile Completeness
                </span>
                <span className="font-medium">+15</span>
              </div>
              {profile.response_rate != null && (
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-primary" /> Response Rate
                  </span>
                  <span className="font-medium">{Math.min(Math.round(profile.response_rate / 10), 15)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-medium text-foreground">
                <span>Total</span>
                <span>{profile.trust_score ?? 0}/100</span>
              </div>
            </div>
          </details>
        </div>

        {(() => {
          const fields = [
            !!profile.full_name, !!profile.avatar_url, !!profile.phone,
            !!profile.location, profile.verification_level && profile.verification_level !== 'unverified',
          ];
          const filled = fields.filter(Boolean).length;
          const pct = Math.round((filled / fields.length) * 100);
          if (pct >= 100) return null;
          return (
            <GlassCard variant="subtle" padding="md" className="mb-6 border-muted">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 text-warning" />
                  Profile completeness
                </p>
                <span className="text-sm text-muted-foreground">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                {!profile.full_name && (
                  <button onClick={() => setEditDialogOpen(true)} className="text-primary hover:underline cursor-pointer">· Add your name</button>
                )}
                {!profile.avatar_url && (
                  <button onClick={() => setEditDialogOpen(true)} className="text-primary hover:underline cursor-pointer">· Upload a profile photo</button>
                )}
                {!profile.phone && (
                  <button onClick={() => setEditDialogOpen(true)} className="text-primary hover:underline cursor-pointer">· Add a phone number</button>
                )}
                {!profile.location && (
                  <button onClick={() => setEditDialogOpen(true)} className="text-primary hover:underline cursor-pointer">· Set your location</button>
                )}
                {(!profile.verification_level || profile.verification_level === 'unverified') && (
                  <button onClick={() => navigate('/verification')} className="text-primary hover:underline cursor-pointer">· Complete identity verification</button>
                )}
              </div>
            </GlassCard>
          );
        })()}

        <ReferralSystem />

        <GlassCard variant="subtle" padding="lg" className="mb-6">
          <h3 className="font-semibold mb-4">Settings</h3>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link to="/notification-settings">
                <Bell className="h-4 w-4 mr-3" />
                Notification Preferences
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link to="/saved-searches">
                <Search className="h-4 w-4 mr-3" />
                Saved Searches
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link to="/help">
                <HelpCircle className="h-4 w-4 mr-3" />
                Help & FAQ
              </Link>
            </Button>
          </div>
        </GlassCard>

        <AccountDeletionSection />

        <ProfileEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={refetchStats}
        />
      </div>
    </>
  );
}

function AccountDeletionSection() {
  const [showDialog, setShowDialog] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const { signOut } = useAuth();

  const handleDelete = async () => {
    if (confirmation !== "DELETE") return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation },
      });
      if (error) throw new Error(error.message);
      await signOut();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
      setLoading(false);
    }
  };

  return (
    <>
      <GlassCard variant="subtle" padding="lg" className="mb-6 border-destructive/20">
        <h3 className="font-semibold text-destructive flex items-center gap-2 mb-2">
          <Trash2 className="h-5 w-5" />
          Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setShowDialog(true)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </GlassCard>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account. You will lose all your listings, reviews, and data.
              Active rentals must be completed or cancelled before deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">
              Type <span className="font-bold text-destructive">DELETE</span> to confirm:
            </p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type DELETE"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmation !== "DELETE" || loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
