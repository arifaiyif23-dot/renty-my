import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminLayout } from "@/components/AdminLayout";
import { toast } from "sonner";
import { format } from "date-fns";
import { invokeAdminOperation } from "@/lib/adminOperations";
import { Loader2, ArrowLeft, Ban, CheckCircle, Shield, Star, Package, CalendarCheck, MessageCircle } from "lucide-react";
import type { Profile } from "@/types";

interface UserItem {
  id: string;
  title: string;
  category: string;
  price_per_day: number;
  is_available: boolean;
  created_at: string;
}

interface UserRental {
  id: string;
  status: string;
  total_price: number;
  start_date: string;
  end_date: string;
  created_at: string;
  item: { title: string } | null;
}

interface UserReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string } | null;
  rental: { item: { title: string } | null } | null;
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string>("user");
  const [items, setItems] = useState<UserItem[]>([]);
  const [rentals, setRentals] = useState<UserRental[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab] = useState<"items" | "rentals" | "reviews">("items");

  useEffect(() => {
    if (id) fetchUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        toast.error("Invalid user ID");
        setLoading(false);
        return;
      }

      const [{ data: profileData }, { data: itemsData }, { data: rentalsData }, { data: reviewsData }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, location, is_verified, verification_level, trust_score, is_suspended, suspension_reason, suspended_at, created_at").eq("id", id).single(),
        supabase.from("items").select("id, title, category, price_per_day, is_available, created_at").eq("owner_id", id).order("created_at", { ascending: false }),
        supabase.from("rentals").select("id, status, total_price, start_date, end_date, created_at, item:items!item_id(title)").or(`renter_id.eq.${id},owner_id.eq.${id}`).order("created_at", { ascending: false }).limit(50),
        supabase.from("reviews").select("id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name), rental:rentals!rental_id(item:items!item_id(title))").eq("reviewee_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
      ]);

      if (profileData) setProfile(profileData);
      if (rolesData) setRole(rolesData.role);
      if (itemsData) setItems(itemsData);
      if (rentalsData) setRentals(rentalsData);
      if (reviewsData) setReviews(reviewsData);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!profile) return;
    setProcessing("verify");
    try {
      await invokeAdminOperation({ action: 'verify_identity', verificationId: '', status: 'approved', userId: profile.id });
      setProfile({ ...profile, is_verified: true, verification_level: "kyc" });
      toast.success("User verified");
    } catch (error) {
      console.error("Error verifying user:", error);
      toast.error("Failed to verify user via admin pipeline");
    } finally {
      setProcessing(null);
    }
  };

  const handleSuspend = async () => {
    if (!profile) return;
    setProcessing("suspend");
    try {
      await invokeAdminOperation({ action: "suspend_user", userId: profile.id, reason: "Suspended by admin" });
      setProfile({ ...profile, is_suspended: true, suspension_reason: "Suspended by admin", suspended_at: new Date().toISOString() });
      toast.success("User suspended");
    } catch (error) {
      console.error("Error suspending user:", error);
      toast.error("Failed to suspend user");
    } finally {
      setProcessing(null);
    }
  };

  const handleUnsuspend = async () => {
    if (!profile) return;
    setProcessing("unsuspend");
    try {
      await invokeAdminOperation({ action: "unsuspend_user", userId: profile.id });
      setProfile({ ...profile, is_suspended: false, suspension_reason: undefined, suspended_at: undefined });
      toast.success("User unsuspended");
    } catch (error) {
      console.error("Error unsuspending user:", error);
      toast.error("Failed to unsuspend user");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout>
        <GlassCard padding="lg">
          <p className="text-center text-muted-foreground">User not found</p>
        </GlassCard>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl">
        <Button className="rounded-lg mb-4" variant="ghost" size="sm" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>

        {/* Profile Header */}
        <GlassCard className="mb-6" padding="lg">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{(profile.full_name || "U")[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.full_name || "Unnamed"}</h1>
                {role === "admin" && <Badge className="bg-destructive rounded-full">Admin</Badge>}
                {role === "moderator" && <Badge className="bg-action rounded-full">Moderator</Badge>}
                {profile.is_verified && <Badge className="bg-success rounded-full">Verified</Badge>}
                {profile.is_suspended && <Badge className="rounded-full" variant="destructive">Suspended</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span>ID: {profile.id}</span>
                <span>Joined {format(new Date(profile.created_at), "MMM yyyy")}</span>
                {profile.location && <span>{profile.location}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                <span className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Verification: {profile.verification_level || "unverified"}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  Trust Score: {profile.trust_score ?? "N/A"}
                </span>
              </div>
              {profile.suspension_reason && (
                <p className="text-sm text-destructive mt-2">Suspension reason: {profile.suspension_reason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!profile.is_verified && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleVerify}
                  disabled={processing === "verify"}
                >
                  {processing === "verify" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Verify
                </Button>
              )}
              {profile.is_suspended ? (
                <Button className="rounded-lg"
                  size="sm"
                  variant="outline"
                  onClick={handleUnsuspend}
                  disabled={processing === "unsuspend"}
                >
                  {processing === "unsuspend" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Unsuspend
                </Button>
              ) : (
                <Button className="rounded-lg"
                  size="sm"
                  variant="destructive"
                  onClick={handleSuspend}
                  disabled={processing === "suspend"}
                >
                  {processing === "suspend" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                  Suspend
                </Button>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Tabs: Items / Rentals / Reviews */}
        <div className="flex gap-2 mb-4">
          <Button className="rounded-lg" variant={tab === "items" ? "default" : "outline"} size="sm" onClick={() => setTab("items")}>
            <Package className="h-4 w-4 mr-2" />
            Items ({items.length})
          </Button>
          <Button className="rounded-lg" variant={tab === "rentals" ? "default" : "outline"} size="sm" onClick={() => setTab("rentals")}>
            <CalendarCheck className="h-4 w-4 mr-2" />
            Rentals ({rentals.length})
          </Button>
          <Button className="rounded-lg" variant={tab === "reviews" ? "default" : "outline"} size="sm" onClick={() => setTab("reviews")}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Reviews ({reviews.length})
          </Button>
        </div>

        {/* Items Tab */}
        {tab === "items" && (
          <div className="space-y-3">
            {items.length === 0 ? (
              <GlassCard padding="lg">
                <p className="text-center text-muted-foreground">No listings from this user</p>
              </GlassCard>
            ) : items.map((item) => (
              <GlassCard key={item.id} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <Badge variant="secondary" className="capitalize text-xs rounded-full">{item.category}</Badge>
                      {item.is_available ? (
                        <Badge className="bg-success text-xs rounded-full">Active</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs rounded-full">Hidden</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      RM{item.price_per_day}/day · Listed {format(new Date(item.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <Button className="rounded-lg" size="sm" variant="outline" onClick={() => navigate(`/items/${item.id}`)}>
                    View
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Rentals Tab */}
        {tab === "rentals" && (
          <div className="space-y-3">
            {rentals.length === 0 ? (
              <GlassCard padding="lg">
                <p className="text-center text-muted-foreground">No rental history</p>
              </GlassCard>
            ) : rentals.map((rental) => (
              <GlassCard key={rental.id} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="rounded-full" variant="secondary">{rental.status}</Badge>
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">{rental.item?.title || "Unknown item"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      RM{Number(rental.total_price).toFixed(2)} · {format(new Date(rental.start_date), "MMM d")} - {format(new Date(rental.end_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(rental.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Reviews Tab */}
        {tab === "reviews" && (
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <GlassCard padding="lg">
                <p className="text-center text-muted-foreground">No reviews received</p>
              </GlassCard>
            ) : reviews.map((review) => (
              <GlassCard key={review.id} padding="md">
                <div className="flex items-start gap-3">
                  <div className="text-lg font-bold text-warning shrink-0">{review.rating}/5</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{review.reviewer?.full_name || "Anonymous"}</span>
                      <span className="text-muted-foreground">on {review.rental?.item?.title || "Unknown item"}</span>
                    </div>
                    {review.comment && <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(review.created_at), "MMM d, yyyy")}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
