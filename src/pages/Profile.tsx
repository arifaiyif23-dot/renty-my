import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Star, Package, ShoppingBag, Edit } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import ProfileEditDialog from "@/components/ProfileEditDialog";

export default function Profile() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    itemsListed: 0,
    rentalsAsRenter: 0,
    rentalsAsOwner: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

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
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                  {profile.is_verified && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Verified
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
                    Edit Profile
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

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                As Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Listed</span>
                  <span className="font-semibold">{stats.itemsListed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Rentals</span>
                  <span className="font-semibold">{stats.rentalsAsOwner}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingBag className="h-5 w-5" />
                As Renter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Rentals</span>
                  <span className="font-semibold">{stats.rentalsAsRenter}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5" />
                Reviews & Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-3xl font-bold text-primary">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.totalReviews}</p>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                </div>
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
