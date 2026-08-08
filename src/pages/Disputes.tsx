import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageLayout } from "@/components/PageLayout";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { EmptyStateV2 } from "@/components/EmptyStateV2";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

interface DisputeDisplay {
  id: string;
  item_title: string;
  dispute_reason: string;
  dispute_status: string;
  created_at: string;
  other_party_name: string;
  role: "renter" | "owner";
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "resolved_refund" || s === "resolved_payout") return "default";
  return "secondary";
};

const statusLabel = (t: TFunction, s: string): string => {
  return t(`disputes.status.${s}`, s);
};

export default function Disputes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [disputes, setDisputes] = useState<DisputeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDisputes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(false);
    setLoading(true);
    try {
      const { data: rentals, error: queryErr } = await supabase
        .from("rentals")
        .select("id, renter_id, owner_id, dispute_reason, dispute_status, is_disputed, created_at, item:items!item_id(title)")
        .eq("is_disputed", true)
        .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (queryErr) throw queryErr;

      const rentalsData = rentals || [];
      const otherPartyIds = rentalsData.map(r =>
        r.renter_id === user.id ? r.owner_id : r.renter_id
      ).filter(Boolean) as string[];

      let profileMap = new Map<string, string>();
      if (otherPartyIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", otherPartyIds);
        profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
      }

      setDisputes(rentalsData.map(r => ({
        id: r.id,
        item_title: (r.item as { title?: string } | null)?.title || t("disputes.unknownItem"),
        dispute_reason: r.dispute_reason || t("disputes.noDetails"),
        dispute_status: r.dispute_status || "open",
        created_at: r.created_at,
        other_party_name: profileMap.get(
          r.renter_id === user.id ? r.owner_id : r.renter_id
        ) || t("disputes.unknown"),
        role: r.renter_id === user.id ? "renter" : "owner",
      })));
    } catch (err) {
      console.error("Failed to load disputes:", err);
      setError(true);
      toast.error(t("disputes.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return (
    <PageLayout variant="default" className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("disputes.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("disputes.subtitle")}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <GlassCard padding="lg">
            <EmptyStateV2
              icon={ShieldAlert}
              title={t("disputes.failedToLoad")}
              description={t("disputes.errorDesc")}
              showRetry
              onRetry={loadDisputes}
            />
          </GlassCard>
        ) : disputes.length === 0 ? (
          <GlassCard padding="lg">
            <EmptyStateV2
              icon={ShieldAlert}
              title={t("disputes.noDisputes")}
              description={t("disputes.noDisputesDesc")}
              actionLabel={t("common.backToDashboard")}
              onAction={() => navigate("/dashboard")}
            />
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <GlassCard key={d.id} variant="subtle" padding="md">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                      {d.item_title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(d.created_at), "PPp")}
                      {" · "}{t("disputes.with")} {d.other_party_name}
                    </p>
                  </div>
                  <Badge variant={statusVariant(d.dispute_status)} className="capitalize rounded-full">
                    {statusLabel(t, d.dispute_status)}
                  </Badge>
                </div>
                <p className="text-sm">{d.dispute_reason}</p>
              </GlassCard>
            ))}
          </div>
        )}
    </PageLayout>
  );
}
