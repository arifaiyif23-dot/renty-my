import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Calendar, Package, Star, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import ItemCard from "@/components/ItemCard";
import { ReviewsList } from "@/components/ReviewsList";
import { UserTrustBadge } from "@/components/trust/UserTrustBadge";
import { ReportDialog } from "@/components/trust/ReportDialog";
import { format } from "date-fns";
import type { Profile, Item } from "@/types";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadUser();
  }, [id]);

  const loadUser = async () => {
    setLoading(true);
    try {
      const [profileRes, itemsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("items")
          .select("*, images:item_images(*)")
          .eq("owner_id", id)
          .eq("listing_status", "active")
          .eq("is_available", true)
          .order("created_at", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const itemsList = itemsRes.data || [];

      // Fetch review stats for all items in one query
      if (itemsList.length > 0) {
        const { data: reviewStats } = await supabase
          .from("reviews")
          .select("item_id, rating")
          .in("item_id", itemsList.map(i => i.id));

        const statsMap = new Map<string, { count: number; sum: number }>();
        reviewStats?.forEach(r => {
          const curr = statsMap.get(r.item_id) || { count: 0, sum: 0 };
          curr.count++;
          curr.sum += r.rating;
          statsMap.set(r.item_id, curr);
        });

        (itemsList as any).forEach((item: any) => {
          const stats = statsMap.get(item.id);
          item._rating = stats ? Math.round((stats.sum / stats.count) * 10) / 10 : 0;
          item._reviewCount = stats?.count || 0;
        });
      }

      setProfile(profileRes.data);
      setItems(itemsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!profile || profile.is_deleted) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav text-center py-20">
          <p className="text-muted-foreground">User not found</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
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
        <div className="mb-6">
          <Link to="/search" className="text-sm text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        </div>

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
                  <UserTrustBadge level={profile.verification_level} trustScore={profile.trust_score} />
                  {profile.is_suspended && (
                    <Badge variant="destructive">Suspended</Badge>
                  )}
                </div>

                {profile.location && (
                  <p className="text-muted-foreground flex items-center gap-1 mb-2">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </p>
                )}

                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(profile.created_at), "MMMM yyyy")}
                </p>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowReport(true)}>
                    Report User
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Listings by {profile.full_name.split(" ")[0]}
        </h2>

        {items.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No active listings</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                id={item.id}
                title={item.title}
                image={item.images?.[0]?.image_url || "/placeholder.svg"}
                pricePerDay={Number(item.price_per_day)}
                category={item.category}
                rating={(item as any)._rating || 0}
                reviewCount={(item as any)._reviewCount || 0}
                location={item.location}
              />
            ))}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewsList userId={id} />
          </CardContent>
        </Card>
      </div>

      <ReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        targetType="user"
        targetId={id || ""}
      />
    </>
  );
}
