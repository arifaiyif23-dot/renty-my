import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Rental } from "@/types";
import { PageLayout } from "@/components/PageLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RentalTimeline } from "@/components/RentalTimeline";
import { PayNowButton } from "@/components/PayNowButton";
import { Loader2, ArrowLeft, Calendar, DollarSign, User, Key, Camera, CheckCircle, XCircle, Clock, AlertTriangle, Ban } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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

const statusBadge = (status: Rental["status"]) => {
  const map: Record<string, { label: string; variant: "warning" | "default" | "success" | "secondary" | "destructive" }> = {
    draft: { label: "Draft", variant: "secondary" },
    requested: { label: "Requested", variant: "warning" },
    payment_pending: { label: "Payment Pending", variant: "warning" },
    reserved: { label: "Reserved", variant: "default" },
    confirmed: { label: "Confirmed", variant: "default" },
    active: { label: "Active", variant: "success" },
    completed: { label: "Completed", variant: "success" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    rejected: { label: "Rejected", variant: "destructive" },
    disputed: { label: "Disputed", variant: "destructive" },
    overdue: { label: "Overdue", variant: "destructive" },
  };
  return map[status] || { label: status, variant: "secondary" as const };
};

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(false);
      const { data, error: fetchError } = await supabase
        .from("rentals")
        .select(`*, item:items(id, title, category, images:item_images(image_url)), renter:profiles!rentals_renter_id_fkey(full_name, avatar_url), owner:profiles!rentals_owner_id_fkey(full_name, avatar_url)`)
        .eq("id", id)
        .single();
      if (fetchError || !data) { setError(true); setLoading(false); return; }
      setRental(data as unknown as Rental);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error || !rental) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Booking not found</p></div>;

  const isOwner = user?.id === rental.owner_id;
  const badge = statusBadge(rental.status);

  const handleApprove = async () => {
    setConfirming(true);
    const { error } = await supabase.functions.invoke("process-rental-approval", { body: { rentalId: rental.id, action: "approve" } });
    if (error) { console.error(error); } else { window.location.reload(); }
    setConfirming(false);
  };
  const handleReject = async () => {
    setConfirming(true);
    const { error } = await supabase.functions.invoke("process-rental-approval", { body: { rentalId: rental.id, action: "reject" } });
    if (error) { console.error(error); } else { window.location.reload(); }
    setConfirming(false);
  };
  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase.functions.invoke("process-rental-approval", { body: { rentalId: rental.id, action: "reject" } });
    if (error) { toast.error(error.message); } else { window.location.reload(); }
    setCancelling(false);
    setCancelDialog(false);
  };
  const handleReportNoShow = async () => {
    setConfirming(true);
    const { error } = await supabase.functions.invoke("confirm-handover", { body: { action: "report_no_show", rentalId: rental.id } });
    if (error) { toast.error(error.message); } else { window.location.reload(); }
    setConfirming(false);
  };

  const canCancel = !isOwner && ["requested", "payment_pending", "reserved"].includes(rental.status);
  const canNoShow = !isOwner && rental.status === "confirmed" && new Date(rental.start_date) < new Date();

  return (
    <PageLayout variant="narrow">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <GlassCard className="p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {rental.item?.images?.[0]?.image_url && (
                <img src={rental.item.images[0].image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div>
                <h1 className="text-lg font-semibold">{rental.item?.title || "Unknown Item"}</h1>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
            </div>
          </div>

          <RentalTimeline rental={rental} />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> {format(new Date(rental.start_date), "MMM d, yyyy")} – {format(new Date(rental.end_date), "MMM d, yyyy")}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /> RM {rental.total_price}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> {isOwner ? rental.renter?.full_name : rental.owner?.full_name}</div>
              {rental.pickup_code && (
                <div className="flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> <span className="font-mono font-bold text-lg">{rental.pickup_code}</span></div>
              )}
            </div>
          </div>

          {/* Renter: Pay Now */}
          {rental.status === "requested" && !isOwner && <PayNowButton rental={rental} onPaymentCreated={() => window.location.reload()} />}

          {/* payment_pending: waiting for payment confirmation */}
          {rental.status === "payment_pending" && !isOwner && (
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg space-y-3">
              <p className="text-sm text-warning flex items-center gap-2"><Clock className="h-4 w-4" /> Waiting for payment confirmation...</p>
              <p className="text-xs text-muted-foreground">Your payment is being processed. This page will update automatically once confirmed.</p>
            </div>
          )}

          {/* Renter: waiting for owner approval */}
          {rental.status === "reserved" && !isOwner && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-sm text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> Waiting for owner to confirm your booking</p>
            </div>
          )}

          {/* Owner: approve/decline */}
          {rental.status === "reserved" && isOwner && (
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleApprove} disabled={confirming}><CheckCircle className="h-4 w-4 mr-2" />Confirm Booking</Button>
              <Button variant="outline" className="flex-1" onClick={handleReject} disabled={confirming}><XCircle className="h-4 w-4 mr-2" />Decline</Button>
            </div>
          )}

          {/* Owner: start handover */}
          {rental.status === "confirmed" && isOwner && (
            <Button className="w-full" onClick={() => navigate(`/rental/${rental.id}`)}><Camera className="h-4 w-4 mr-2" />Start Handover</Button>
          )}

          {/* Renter: no-show report */}
          {canNoShow && (
            <Button variant="outline" className="w-full text-destructive border-destructive/30" onClick={handleReportNoShow} disabled={confirming}>
              <AlertTriangle className="h-4 w-4 mr-2" /> Vendor not showing?
            </Button>
          )}

          {/* Owner: process return */}
          {(rental.status === "active" || rental.status === "overdue") && isOwner && (
            <Button className="w-full" variant={rental.status === "overdue" ? "destructive" : "default"} onClick={() => navigate(`/rental/${rental.id}`)}>
              <CheckCircle className="h-4 w-4 mr-2" />Process Return
            </Button>
          )}

          {/* Review */}
          {(rental.status === "completed" || rental.status === "disputed") && (
            <Button variant="outline" className="w-full" onClick={() => navigate(`/review/${rental.id}`)}>Leave a Review</Button>
          )}

          {/* Renter: cancel booking */}
          {canCancel && (
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setCancelDialog(true)}>
              <Ban className="h-4 w-4 mr-2" />Cancel Booking
            </Button>
          )}
        </GlassCard>

      <AlertDialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to cancel this booking? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

