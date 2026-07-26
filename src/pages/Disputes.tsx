import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import Header from "@/components/Header";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import EnhancedEmptyState from "@/components/EnhancedEmptyState";
import { format } from "date-fns";
import { toast } from "sonner";

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

const statusLabel = (s: string): string => {
  if (s === "open") return "Open";
  if (s === "resolved_refund") return "Resolved (Refund)";
  if (s === "resolved_payout") return "Resolved (Payout)";
  return s;
};

export default function Disputes() {
  const { user } = useAuth();
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
        item_title: (r.item as { title?: string } | null)?.title || "Unknown Item",
        dispute_reason: r.dispute_reason || "No details provided",
        dispute_status: r.dispute_status || "open",
        created_at: r.created_at,
        other_party_name: profileMap.get(
          r.renter_id === user.id ? r.owner_id : r.renter_id
        ) || "Unknown",
        role: r.renter_id === user.id ? "renter" : "owner",
      })));
    } catch (err) {
      console.error("Failed to load disputes:", err);
      setError(true);
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Disputes</h1>
            <p className="text-sm text-muted-foreground">All disputes you're involved in</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <GlassCard padding="lg">
            <EnhancedEmptyState
              icon={ShieldAlert}
              title="Failed to load disputes"
              description="Something went wrong while loading your disputes. Please try again."
              showRetry
              onRetry={loadDisputes}
            />
          </GlassCard>
        ) : disputes.length === 0 ? (
          <GlassCard padding="lg">
            <EnhancedEmptyState
              icon={ShieldAlert}
              title="No disputes"
              description="You haven't been involved in any disputes. Disputes can be opened from a completed rental if there's an issue."
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
                      {" · "}with {d.other_party_name}
                    </p>
                  </div>
                  <Badge variant={statusVariant(d.dispute_status)} className="capitalize rounded-full">
                    {statusLabel(d.dispute_status)}
                  </Badge>
                </div>
                <p className="text-sm">{d.dispute_reason}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
