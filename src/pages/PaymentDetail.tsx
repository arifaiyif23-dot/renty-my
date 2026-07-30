import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(false);
      const { data, error: fetchError } = await supabase
        .from("payments")
        .select("*, rental:rentals(id, total_price, status, start_date, end_date, item:items(title, images:item_images(image_url)))")
        .eq("id", id)
        .maybeSingle();
      if (fetchError || !data) { setError(true); setLoading(false); return; }
      setPayment(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error || !payment) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Payment not found</p></div>;

  const statusIcon: Record<string, JSX.Element> = {
    paid: <CheckCircle className="h-5 w-5 text-success" />,
    pending: <Clock className="h-5 w-5 text-warning" />,
    draft: <Clock className="h-5 w-5 text-muted-foreground" />,
    failed: <XCircle className="h-5 w-5 text-destructive" />,
    expired: <XCircle className="h-5 w-5 text-destructive" />,
  };

  const statusLabel: Record<string, string> = {
    paid: "Paid",
    pending: "Pending",
    draft: "Processing",
    failed: "Failed",
    expired: "Expired",
  };

  return (
    <PageLayout variant="narrow">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <GlassCard className="p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">Payment Details</h1>
              <p className="text-sm text-muted-foreground">ID: {payment.id.slice(0, 8)}...</p>
            </div>
            <div className="flex items-center gap-2">
              {statusIcon[payment.status] || <Clock className="h-5 w-5" />}
              <Badge variant={payment.status === "paid" ? "success" : payment.status === "failed" || payment.status === "expired" ? "destructive" : "warning"}>
                {statusLabel[payment.status] || payment.status}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {payment.rental?.item?.images?.[0]?.image_url && (
                <img src={payment.rental.item.images[0].image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div>
                <p className="font-medium">{payment.rental?.item?.title || "Item"}</p>
                <p className="text-sm text-muted-foreground">{payment.rental?.start_date && payment.rental?.end_date ? `${format(new Date(payment.rental.start_date), "MMM d")} – ${format(new Date(payment.rental.end_date), "MMM d")}` : ""}</p>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Rental Amount</span><span>RM {Number(payment.rental_amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Platform Fee</span><span>RM {Number(payment.platform_fee).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>RM {Number(payment.total_amount).toFixed(2)}</span></div>
            </div>

            {payment.paid_at && (
              <p className="text-xs text-muted-foreground">Paid at: {format(new Date(payment.paid_at), "MMM d, yyyy HH:mm")}</p>
            )}
          </div>

          {payment.status === "pending" && payment.toyyibpay_bill_url && (
            <Button className="w-full" onClick={() => window.open(payment.toyyibpay_bill_url, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Complete Payment
            </Button>
          )}

          {payment.status === "paid" && (
            <Button variant="outline" className="w-full" onClick={() => navigate(`/booking/${payment.rental?.id}`)}>
              View Booking
            </Button>
          )}
        </GlassCard>
    </PageLayout>
  );
}
