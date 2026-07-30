import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from 'react-router-dom';
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
import { MapPin, Calendar, Edit, ShieldCheck, ShieldAlert, Bell, Search, HelpCircle, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { UserTrustBadge, TrustScoreRing } from "@/components/trust/UserTrustBadge";
import { format } from "date-fns";
import { PageLayout } from "@/components/PageLayout";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import ProfileSkeleton from "@/components/ProfileSkeleton";
import { toast } from "sonner";
import { useProfileStatsQuery, useVerificationStatusQuery } from "@/hooks/use-profile-query";
import { useAdminCheck } from "@/hooks/use-admin-check";
import { useActiveStatus } from "@/hooks/use-active-status";
import { getSrcSet } from "@/utils/imageOptimization";

export default function Profile() {
  const { user, profile, error: authError } = useAuth();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { data: isAdmin } = useAdminCheck(user?.id);
  useActiveStatus(user?.id);

  const { data: stats } = useProfileStatsQuery(user?.id);
  const { data: verificationStatus } = useVerificationStatusQuery(user?.id);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { signOut } = useAuth();

  const handleDelete = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation: "DELETE" } });
      if (error) throw new Error(error.message);
      await signOut();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
      setDeleteLoading(false);
    }
  };

  if (authError && !profile) {
    return (
      <PageLayout variant="narrow" className="text-center py-12">
          <p className="text-muted-foreground">Failed to load profile</p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-3">Try Again</Button>
      </PageLayout>
    );
  }

  if (!profile) {
    return <PageLayout variant="narrow"><ProfileSkeleton /></PageLayout>;
  }

  const initials = (profile.full_name || '').split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || 'U';

  return (
    <PageLayout variant="narrow">
        {!profile.is_verified && !verificationStatus && (
          <div className="flex items-center justify-between p-3 mb-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Verify your identity to book items</span>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={() => navigate('/verification')}>Verify</Button>
          </div>
        )}

        {verificationStatus?.status === 'pending' && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/20 text-sm">
            <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
            <span className="text-muted-foreground">Verification pending — we'll notify you within 24-48 hours.</span>
          </div>
        )}

        {verificationStatus?.status === 'rejected' && (
          <div className="flex items-center justify-between p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-muted-foreground">Verification rejected{verificationStatus.rejection_reason ? `: ${verificationStatus.rejection_reason}` : ''}.</span>
            </div>
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => navigate('/verification')}>Retry</Button>
          </div>
        )}

        <div className="card-base p-6 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Avatar className="h-16 w-16 ring-2 ring-border">
              <AvatarImage src={profile.avatar_url} srcSet={getSrcSet(profile.avatar_url || '')} sizes="64px" alt={profile.full_name} />
              <AvatarFallback className="text-xl rounded-full">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-bold">{profile.full_name}</h1>
                <UserTrustBadge level={profile.verification_level} trustScore={profile.trust_score} size="sm" />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {profile.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location}</span>}
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {format(new Date(profile.created_at), "MMM yyyy")}</span>
                {profile.response_rate != null && (
                  <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {Math.round(profile.response_rate)}% response</span>
                )}
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" className="h-8 text-xs" onClick={() => setEditDialogOpen(true)}><Edit className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate('/my-listings')}>My Items</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate('/dashboard')}>Rentals</Button>
                {isAdmin?.isAdmin && (
                  <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => navigate('/admin')}>Admin</Button>
                )}
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate('/earnings')}>Earnings</Button>
              </div>
            </div>

            <div className="shrink-0 self-center text-center">
              <TrustScoreRing score={profile.trust_score ?? 0} size={48} />
              {profile.trust_score != null && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {profile.trust_score >= 80 ? 'Trusted'
                    : profile.trust_score >= 50 ? 'Normal'
                    : 'New User'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{stats?.itemsListed || 0}</p>
            <p className="text-xs text-muted-foreground">Items Listed</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{stats?.rentalsAsOwner || 0}</p>
            <p className="text-xs text-muted-foreground">Rentals Given</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{stats?.rentalsAsRenter || 0}</p>
            <p className="text-xs text-muted-foreground">Total Rentals</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{stats && stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
        </div>

        <div className="card-base p-4 mb-4">
          <h3 className="text-sm font-medium mb-2">Settings</h3>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild><Link to="/notification-settings"><Bell className="h-3.5 w-3.5 mr-1.5" /> Notifications</Link></Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild><Link to="/saved-searches"><Search className="h-3.5 w-3.5 mr-1.5" /> Saved Searches</Link></Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild><Link to="/help"><HelpCircle className="h-3.5 w-3.5 mr-1.5" /> Help</Link></Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild><Link to="/verification"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Verification</Link></Button>
          </div>
        </div>

        <div className="card-base p-4 border-destructive/20">
          <button onClick={() => setShowDeleteDialog(true)} className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>

      <ProfileEditDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} onSuccess={() => {}} />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account and all data. Active rentals must be completed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">Type <span className="font-bold text-destructive">DELETE</span> to confirm:</p>
            <Input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="Type DELETE" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteConfirmation !== "DELETE" || deleteLoading} className="bg-destructive hover:bg-destructive/90">
              {deleteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
