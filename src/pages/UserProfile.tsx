import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Calendar, Package, Star, ArrowLeft, Loader2, MessageCircle, Clock, CheckCircle2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import { ReviewsList } from "@/components/ReviewsList";
import { UserTrustBadge } from "@/components/trust/UserTrustBadge";
import { ReportDialog } from "@/components/trust/ReportDialog";
import { format, formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import type { Profile, Item } from "@/types";
import { getSrcSet } from "@/utils/imageOptimization";

interface ItemWithRating extends Item {
  _rating: number;
  _reviewCount: number;
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile: currentProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<ItemWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    if (!id) return;
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleMessage = () => {
    if (!currentProfile) { toast.error(t('messages.signInToMessage')); navigate('/auth'); return; }
    if (!id || id === currentProfile.id) return;
    if (!currentProfile.is_verified) { toast.error(t('messages.verifyIdentity')); navigate('/verification'); return; }
    navigate('/messages', { state: { recipientId: id } });
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const [profileRes, publicProfileRes, itemsRes, ratingRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, is_verified, verification_level, trust_score, location, bio, created_at, is_suspended, is_deleted, total_rentals_completed, total_reviews_received, response_rate, avg_response_time_minutes, last_active_at").eq("id", id).maybeSingle(),
        // Fallback for anonymous visitors: RLS hides the full profiles table from
        // anon, but public_profiles view exposes safe fields to everyone.
        supabase.from("public_profiles").select("id, full_name, avatar_url, is_verified, verification_level, trust_score, location, created_at, is_suspended").eq("id", id).maybeSingle(),
        supabase
          .from("items")
          .select("*, images:item_images(*)")
          .eq("owner_id", id)
          .eq("status", "available")
          .order("created_at", { ascending: false }),
        supabase.from("reviews").select("rating").eq("reviewee_id", id || ""),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (ratingRes.error) throw ratingRes.error;

      const itemsList = itemsRes.data || [];

      if (ratingRes.data && ratingRes.data.length > 0) {
        setAvgRating(ratingRes.data.reduce((s, r) => s + r.rating, 0) / ratingRes.data.length);
      }

      // Full profile row for logged-in users (RLS: self or active item owners);
      // public_profiles view as fallback so anonymous visitors still see the
      // owner's public info instead of a "User not found" page.
      const mergedProfile = (profileRes.data ?? publicProfileRes.data ?? null) as Profile | null;

      // Always populate items (even with zero reviews) — previously setItems was
      // only called inside the itemStats branch, so listings vanished when a user
      // had items but no reviews yet.
      const statsMap = new Map<string, { count: number; sum: number }>();
      if (itemsList.length > 0) {
        const { data: itemStats } = await supabase
          .from("reviews")
          .select("rating, rental:rentals(item_id)")
          .in("rental.item_id", itemsList.map(i => i.id));

        if (itemStats) {
          itemStats.forEach((r: { rental: { item_id: string } | null; rating: number }) => {
            const itemId = r.rental?.item_id;
            if (!itemId) return;
            const curr = statsMap.get(itemId) || { count: 0, sum: 0 };
            curr.count++;
            curr.sum += r.rating;
            statsMap.set(itemId, curr);
          });
        }
      }

      setItems(itemsList.map((item) => {
        const stats = statsMap.get(item.id);
        return {
          ...item,
          _rating: stats ? Math.round((stats.sum / stats.count) * 10) / 10 : 0,
          _reviewCount: stats?.count || 0,
        };
      }));

      setProfile(mergedProfile);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLayout variant="default" className="max-w-4xl flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageLayout>
    );
  }

  if (!profile || profile.is_deleted) {
    return (
      <PageLayout variant="default" className="max-w-4xl text-center py-20">
          <p className="text-muted-foreground">{t('userProfile.notFound')}</p>
          <Button variant="outline" className="mt-4 rounded-lg" asChild>
            <Link to="/">{t('userProfile.backHome')}</Link>
          </Button>
      </PageLayout>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <PageLayout variant="default" className="max-w-4xl">
        <div className="mb-4">
          <Link to="/search" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            {t('userProfile.backSearch')}
          </Link>
        </div>

        <GlassCard padding="lg" className="mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-2 ring-primary/10">
              <AvatarImage src={profile.avatar_url} srcSet={getSrcSet(profile.avatar_url || '')} sizes="96px" />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                <UserTrustBadge level={profile.verification_level} trustScore={profile.trust_score} />
                {profile.is_suspended && (
                  <Badge variant="destructive" className="rounded-full">{t('userProfile.suspended')}</Badge>
                )}
              </div>

              {profile.location && (
                <p className="text-muted-foreground flex items-center gap-1 mb-1 text-sm">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {profile.created_at ? t('userProfile.joined') + ' ' + format(new Date(profile.created_at), "MMMM yyyy") : null}
                </span>
                {profile.last_active_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Date.now() - new Date(profile.last_active_at).getTime() < 2 * 60 * 1000
                      ? t('userProfile.activeNow')
                      : t('userProfile.activeAgo', { time: formatDistanceToNow(new Date(profile.last_active_at), { addSuffix: false }) })}
                  </span>
                )}
                {profile.response_rate != null && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {profile.response_rate >= 90 ? t('userProfile.respondsUsually') : t('userProfile.respondsWithin')}{" "}
                    {profile.avg_response_time_minutes != null
                      ? profile.avg_response_time_minutes < 1
                        ? t('userProfile.underMin')
                        : profile.avg_response_time_minutes < 60
                          ? t('userProfile.min', { count: Math.round(profile.avg_response_time_minutes) })
                          : t('userProfile.hr', { count: Math.round(profile.avg_response_time_minutes / 60) })
                      : t('userProfile.defaultTime')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-1.5 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium">
                    {avgRating > 0 ? t('userProfile.avgRating', { rating: avgRating.toFixed(1) }) : t('userProfile.noRatings')}
                  </span>
                  <span className="text-muted-foreground">({profile.total_reviews_received || 0})</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{t('userProfile.rentalsCompleted', { count: profile.total_rentals_completed || 0 })}</span>
                </div>
                {profile.response_rate != null && (
                  <div className="flex items-center gap-1.5 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span>{t('userProfile.responseRate', { count: Math.round(profile.response_rate) })}</span>
                  </div>
                )}
              </div>

              {user?.id !== id && (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={handleMessage}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t('userProfile.messageUser')}
                </Button>
              )}

              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowReport(true)}>
                {t('userProfile.reportUser')}
              </Button>
            </div>
          </div>
        </GlassCard>

        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('userProfile.listingsBy', { name: profile.full_name.split(" ")[0] })}
        </h2>

        {items.length === 0 ? (
          <GlassCard padding="md" className="text-center text-muted-foreground py-8">{t('userProfile.noActiveListings')}</GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {items.map((item) => (
              <ListingCard
                key={item.id}
                id={item.id}
                title={item.title}
                image={item.images?.[0]?.image_url || "/placeholder.svg"}
                pricePerDay={Number(item.price_per_day)}
                category={item.category}
                rating={item._rating}
                reviewCount={item._reviewCount}
                location={item.location}
                verificationLevel={profile?.verification_level}
              />
            ))}
          </div>
        )}

        <GlassCard padding="lg" className="mt-6">
          <h2 className="font-semibold text-lg mb-4">{t('userProfile.reviews')}</h2>
          <ReviewsList userId={id} />
        </GlassCard>

      <ReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        targetType="user"
        targetId={id || ""}
      />
    </PageLayout>
  );
}
