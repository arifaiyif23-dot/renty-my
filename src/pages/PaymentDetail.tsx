import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";
import { SkeletonV2 } from "@/components/SkeletonV2";
import { format } from "date-fns";
import { formatRentalPeriod } from "@/lib/rentalTime";

export default function PaymentDetail() {
  const { t } = useTranslation();
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
        .select("*, rental:rentals(id, total_price, status, start_date, end_date, pickup_time, return_time, item:items(title, images:item_images(image_url)))")
        .eq("id", id)
        .maybeSingle();
      if (fetchError || !data) { setError(true); setLoading(false); return; }
      setPayment(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <PageLayout variant="narrow">
        <SkeletonV2 variant="text" className="h-8 w-32 mb-4" />
        <div className="card-base p-5 space-y-5 rounded-lg">
          <div className="flex items-start justify-between">
            <SkeletonV2 variant="text" className="h-6 w-40" />
            <SkeletonV2 variant="text" className="h-6 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonV2 variant="rectangular" className="w-12 h-12 rounded-lg" />
            <SkeletonV2 variant="text" className="h-4 w-2/3" />
          </div>
          <div className="space-y-2 border-t pt-3">
            <SkeletonV2 variant="text" className="h-4 w-full" />
            <SkeletonV2 variant="text" className="h-4 w-full" />
            <SkeletonV2 variant="text" className="h-5 w-1/2" />
          </div>
          <SkeletonV2 variant="rectangular" className="h-10 rounded-lg" />
        </div>
      </PageLayout>
    );
  }
  if (error || !payment) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">{t('paymentDetail.notFound')}</p></div>;

  const statusIcon: Record<string, JSX.Element> = {
    paid: <CheckCircle className="h-5 w-5 text-success" />,
    pending: <Clock className="h-5 w-5 text-warning" />,
    draft: <Clock className="h-5 w-5 text-muted-foreground" />,
    failed: <XCircle className="h-5 w-5 text-destructive" />,
    expired: <XCircle className="h-5 w-5 text-destructive" />,
  };

  const statusLabel: Record<string, string> = {
    paid: t('paymentDetail.paid'),
    pending: t('paymentDetail.pending'),
    draft: t('paymentDetail.processing'),
    failed: t('paymentDetail.failed'),
    expired: t('paymentDetail.expired'),
  };

  return (
    <PageLayout variant="narrow">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
        </Button>

        <div className="card-base p-5 space-y-5 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t('paymentDetail.title')}</h1>
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
                <p className="text-sm text-muted-foreground">{payment.rental?.start_date && payment.rental?.end_date ? formatRentalPeriod(payment.rental.start_date, payment.rental.end_date, payment.rental.pickup_time, payment.rental.return_time) : ""}</p>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('paymentDetail.rentalAmount')}</span><span>RM {Number(payment.rental_amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('paymentDetail.platformFee')}</span><span>RM {Number(payment.platform_fee).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-base border-t pt-2"><span>{t('paymentDetail.total')}</span><span>RM {Number(payment.total_amount).toFixed(2)}</span></div>
            </div>

            {payment.paid_at && (
              <p className="text-xs text-muted-foreground">{t('paymentDetail.paidAt')}: {format(new Date(payment.paid_at), "MMM d, yyyy HH:mm")}</p>
            )}
          </div>

          {payment.status === "pending" && payment.toyyibpay_bill_url && (
            <Button className="w-full" onClick={() => window.open(payment.toyyibpay_bill_url, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" /> {t('paymentDetail.completePayment')}
            </Button>
          )}

          {payment.status === "paid" && (
            <Button variant="outline" className="w-full" onClick={() => navigate(`/booking/${payment.rental?.id}`)}>
              {t('paymentDetail.viewBooking')}
            </Button>
          )}
        </div>
    </PageLayout>
  );
}
