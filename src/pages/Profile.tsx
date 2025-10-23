import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Star, Package, ShoppingBag, Edit, ShieldCheck, ShieldAlert, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import ProfileEditDialog from "@/components/ProfileEditDialog";

export default function Profile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    itemsListed: 0,
    rentalsAsRenter: 0,
    rentalsAsOwner: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchVerificationStatus();
    }
  }, [user]);

  const fetchVerificationStatus = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('verification_requests')
        .select('status, created_at, overall_confidence_score')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setVerificationStatus(data);
      }
    } catch (error) {
      console.error("Error fetching verification status:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const [itemsResult, renterResult, ownerResult, reviewsResult] = await Promise.all([
        supabase.from("items").select("id", { count: "exact" }).eq("owner_id", user?.id),
        supabase.from("rentals").select("id", { count: "exact" }).eq("renter_id", user?.id),
        supabase.from("rentals").select("id", { count: "exact" }).eq("owner_id", user?.id),
        supabase.from("reviews").select("rating").eq("reviewee_id", user?.id),
      ]);

      const avgRating = reviewsResult.data && reviewsResult.data.length > 0
        ? reviewsResult.data.reduce((sum, r) => sum + r.rating, 0) / reviewsResult.data.length
        : 0;

      setStats({
        itemsListed: itemsResult.count || 0,
        rentalsAsRenter: renterResult.count || 0,
        rentalsAsOwner: ownerResult.count || 0,
        averageRating: avgRating,
        totalReviews: reviewsResult.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4">
          <div className="text-center py-8">Loading...</div>
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
                  <Link to="/dashboard">
                    <Button size="sm" variant="outline">Dashboard</Button>
                  </Link>
                  <Link to="/wallet">
                    <Button size="sm" variant="outline">Wallet</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="min-h-[140px]">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Items Listed</p>
                <p className="text-3xl font-bold">{stats.itemsListed}</p>
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
                <p className="text-3xl font-bold">{stats.rentalsAsOwner}</p>
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
                <p className="text-3xl font-bold">{stats.rentalsAsRenter}</p>
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
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">({stats.totalReviews})</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
              </div>
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Star className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 dark:text-yellow-400 fill-yellow-600 dark:fill-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile Dialog */}
        <ProfileEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchStats}
        />
      </div>
    </>
  );
}
