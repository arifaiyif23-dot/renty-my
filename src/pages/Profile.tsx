import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Star, Package, ShoppingBag, Edit, ShieldCheck, ShieldAlert, ListChecks, RefreshCw } from "lucide-react";
import { format } from "date-fns";
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

export default function Profile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { data: isAdmin } = useAdminCheck(user?.id);
  const isMobile = useIsMobile();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useProfileStatsQuery(user?.id);
  const { data: verificationStatus, refetch: refetchVerification } = useVerificationStatusQuery(user?.id);

  const refreshProfile = async () => {
    await Promise.all([refetchStats(), refetchVerification()]);
  };

  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await refreshProfile();
    toast.success('Profile updated');
  }, isMobile);

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

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav">
        {pullDistance > 0 && (
          <div className="flex justify-center py-2">
            <RefreshCw className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
          </div>
        )}
        {/* Verification Status Banner */}
        {!profile.is_verified && !verificationStatus && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <div className="flex items-start gap-4">
                <ShieldAlert className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <CardTitle>Verify Your Identity</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Get verified to unlock premium rentals, build trust with the community, and increase your visibility.
                  </p>
                  <Button onClick={() => navigate('/verification')} className="mt-4">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Start Verification
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {verificationStatus && verificationStatus.status === 'pending' && (
          <Card className="mb-6 border-yellow-500">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Verification Under Review</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your verification is being reviewed by our team. We'll notify you within 24-48 hours.
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {verificationStatus && verificationStatus.status === 'rejected' && (
          <Card className="mb-6 border-red-500">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Verification Rejected</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your verification was rejected. Please review your documents and try again.
                  </p>
                  <Button onClick={() => navigate('/verification')} variant="destructive" className="mt-4">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-20 w-20 md:h-24 md:w-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                  {profile.is_verified && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                      ID Verified
                    </Badge>
                  )}
                </div>

                {profile.location && (
                  <p className="text-muted-foreground flex items-center gap-1 mb-2">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </p>
                )}

                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(profile.created_at), "MMMM yyyy")}
                </p>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <Button size="sm" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('profile.editProfile')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/my-listings')}>
                    <ListChecks className="h-4 w-4 mr-2" />
                    {t('profile.manageListing')}
                  </Button>
                  {isAdmin && (
                    <Link to="/admin">
                      <Button size="sm" variant="secondary" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="min-h-[140px]">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Items Listed</p>
                <p className="text-3xl font-bold">{stats?.itemsListed || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">As Owner</p>
              </div>
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[140px]">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rentals Given</p>
                <p className="text-3xl font-bold">{stats?.rentalsAsOwner || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">As Owner</p>
              </div>
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 md:h-8 md:w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[140px]">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Rentals</p>
                <p className="text-3xl font-bold">{stats?.rentalsAsRenter || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">As Renter</p>
              </div>
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="h-6 w-6 md:h-8 md:w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[140px]">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Average Rating</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-primary">
                    {stats && stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">({stats?.totalReviews || 0})</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
              </div>
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Star className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 dark:text-yellow-400 fill-yellow-600 dark:fill-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral System Section */}
        <ReferralSystem />

        {/* Edit Profile Dialog */}
        <ProfileEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={refetchStats}
        />
      </div>
    </>
  );
}
