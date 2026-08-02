import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Rental } from "@/types";
import { PageLayout } from "@/components/PageLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { RentalTimeline } from "@/components/RentalTimeline";
import { HandoverDialog } from "@/components/HandoverDialog";
import { ReturnDisputeDialog } from "@/components/ReturnDisputeDialog";
import { RentalStatusBadge } from "@/components/RentalStatusBadge";
import { ArrowLeft, Calendar, DollarSign, User, Camera, CheckCircle } from "lucide-react";
import { SkeletonV2 } from "@/components/SkeletonV2";
import { format } from "date-fns";
import { formatRentalPeriod } from "@/lib/rentalTime";

export default function RentalDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [events, setEvents] = useState<{ id: string; old_status: string; new_status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    const { data, error: fetchError } = await supabase
      .from("rentals")
      .select(`*, item:items(id, title, category, price_per_day, images:item_images(image_url)), renter:profiles!rentals_renter_id_fkey(full_name, avatar_url), owner:profiles!rentals_owner_id_fkey(full_name, avatar_url)`)
      .eq("id", id)
      .single();
    if (fetchError || !data) { setError(true); setLoading(false); return; }
    setRental(data as unknown as Rental);

    const { data: ev } = await supabase.from("booking_events").select("*").eq("rental_id", id).order("created_at", { ascending: true });
    setEvents(ev || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <PageLayout variant="narrow">
        <SkeletonV2 variant="text" className="h-8 w-32 mb-4" />
        <div className="flex items-center gap-3 mb-5">
          <SkeletonV2 variant="rectangular" className="w-16 h-16 rounded-lg" />
          <div className="space-y-2 flex-1">
            <SkeletonV2 variant="text" className="h-5 w-2/3" />
            <SkeletonV2 variant="text" className="h-4 w-24" />
          </div>
        </div>
        <div className="card-base p-5 space-y-5 rounded-lg mb-4">
          <SkeletonV2 variant="rectangular" className="h-24 rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <SkeletonV2 variant="text" className="h-4 w-full" />
            <SkeletonV2 variant="text" className="h-4 w-full" />
          </div>
          <SkeletonV2 variant="rectangular" className="h-10 rounded-lg" />
        </div>
      </PageLayout>
    );
  }
  if (error || !rental) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">{t('rentalDetail.notFound')}</p></div>;

  const isOwner = user?.id === rental.owner_id;

  return (
    <PageLayout variant="narrow">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
        </Button>

        <div className="flex items-center gap-3 mb-5">
          {rental.item?.images?.[0]?.image_url && (
            <img src={rental.item.images[0].image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div>
            <h1 className="text-xl font-bold">{rental.item?.title || t('rentalDetail.title')}</h1>
            <RentalStatusBadge status={rental.status} />
          </div>
        </div>

        <GlassCard className="p-5 space-y-5 mb-4">
          <RentalTimeline rental={rental} />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> {formatRentalPeriod(rental.start_date, rental.end_date, rental.pickup_time, rental.return_time)}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /> RM {rental.total_price} ({rental.item?.price_per_day ? `RM${rental.item.price_per_day}/day` : ""})</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> {isOwner ? `${t('rentalDetail.renter')}: ${rental.renter?.full_name || "Unknown"}` : `${t('rentalDetail.owner')}: ${rental.owner?.full_name || "Unknown"}`}</div>
              {rental.actual_start_at && <p className="text-muted-foreground">{t('rentalDetail.startedAt')}: {format(new Date(rental.actual_start_at), "MMM d, HH:mm")}</p>}
              {rental.return_photos && <div className="flex items-center gap-1"><Camera className="h-4 w-4" /> {rental.return_photos.length} {t('rentalDetail.returnPhotos')}</div>}
            </div>
          </div>

          {rental.status === "confirmed" && isOwner && (
            <Button className="w-full" onClick={() => setHandoverOpen(true)}>
              <Camera className="h-4 w-4 mr-2" /> {t('rentalDetail.startHandover')}
            </Button>
          )}

          {(rental.status === "active" || rental.status === "overdue") && isOwner && (
            <Button className="w-full" variant={rental.status === "overdue" ? "destructive" : "default"} onClick={() => setReturnOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" /> {t('rentalDetail.processReturn')}
            </Button>
          )}

          {rental.handover_photos && rental.handover_photos.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{t('rentalDetail.handoverPhotos')}</p>
              <div className="flex gap-2 overflow-x-auto">
                {rental.handover_photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                ))}
              </div>
            </div>
          )}

          {rental.return_photos && rental.return_photos.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{t('rentalDetail.returnPhotosLabel')}</p>
              <div className="flex gap-2 overflow-x-auto">
                {rental.return_photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {events.length > 0 && (
          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold mb-3">{t('rentalDetail.eventHistory')}</h2>
            <div className="space-y-2">
              {events.map((ev, i) => (
                <div key={ev.id || i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary/50" />
                  <span>{ev.old_status} → {ev.new_status}</span>
                  <span className="text-xs">{format(new Date(ev.created_at), "MMM d, HH:mm")}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        <div className="mt-4 flex gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/booking/${rental.id}`)}>{t('rentalDetail.viewBooking')}</Button>
          {(rental.status === "completed" || rental.status === "disputed") && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/review/${rental.id}`)}>{t('rentalDetail.review')}</Button>
          )}
        </div>
      <HandoverDialog rental={rental} open={handoverOpen} onOpenChange={setHandoverOpen} onSuccess={fetchData} />
      <ReturnDisputeDialog rental={rental} open={returnOpen} onOpenChange={setReturnOpen} onSuccess={fetchData} />
    </PageLayout>
  );
}
