import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Rental } from "@/types";
import { PageLayout } from "@/components/PageLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewsList } from "@/components/ReviewsList";
import { ArrowLeft, Star } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { format } from "date-fns";

export default function ReviewPage() {
  const { rentalId } = useParams<{ rentalId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!rentalId) return;
    (async () => {
      setLoading(true);
      setError(false);
      const { data, error: fetchError } = await supabase
        .from("rentals")
        .select("id, renter_id, owner_id, status, total_price, start_date, end_date, item:items(id, title, images:item_images(image_url))")
        .eq("id", rentalId)
        .single();
      if (fetchError || !data) { setError(true); setLoading(false); return; }
      setRental(data);
      setLoading(false);
    })();
  }, [rentalId]);

  if (loading) return <LoadingSpinner />;
  if (error || !rental) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Rental not found</p></div>;

  const canReview = ["completed", "disputed"].includes(rental.status);
  const isOwner = user?.id === rental.owner_id;
  const revieweeId = isOwner ? rental.renter_id : rental.owner_id;

  return (
    <PageLayout variant="narrow">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <GlassCard className="p-5 space-y-4 mb-4">
          <div className="flex items-center gap-3">
            {rental.item?.images?.[0]?.image_url && (
              <img src={rental.item.images[0].image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="text-lg font-semibold">{rental.item?.title || "Item"}</h1>
              <p className="text-sm text-muted-foreground">{format(new Date(rental.start_date), "MMM d")} – {format(new Date(rental.end_date), "MMM d")} · RM {rental.total_price}</p>
            </div>
          </div>
        </GlassCard>

        {canReview && !submitted && (
          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Star className="h-4 w-4" /> Rate your experience</h2>
            <ReviewForm rentalId={rental.id} revieweeId={revieweeId} onSuccess={() => setSubmitted(true)} />
          </GlassCard>
        )}

        {!canReview && (
          <GlassCard className="p-5 text-center space-y-2">
            <p className="text-muted-foreground">Reviews are only available after the rental is completed.</p>
            <Button variant="outline" size="sm" onClick={() => navigate(`/booking/${rental.id}`)}>Back to Booking</Button>
          </GlassCard>
        )}

        {submitted && (
          <GlassCard className="p-5 text-center space-y-2">
            <p className="text-success font-semibold">Review submitted!</p>
            <Button variant="outline" size="sm" onClick={() => navigate(`/booking/${rental.id}`)}>Back to Booking</Button>
          </GlassCard>
        )}

        <div className="mt-4">
          <h2 className="text-sm font-semibold mb-2">Reviews for this item</h2>
          <ReviewsList itemId={rental.item?.id} userId={user?.id || ""} />
        </div>
    </PageLayout>
  );
}
