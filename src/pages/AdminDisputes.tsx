import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdminLayout } from "@/components/AdminLayout";
import { invokeAdminOperation } from "@/lib/adminOperations";
import { Loader2, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AdminDispute {
  id: string;
  rental_id: string;
  filed_by: string;
  filed_against: string;
  dispute_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  resolution_amount: number | null;
  created_at: string;
  renter?: { full_name: string };
  owner?: { full_name: string };
  item?: { title: string };
}

type ResolveAction = "refund_renter" | "release_owner" | "split";

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "investigating" | "resolved" | "all">("open");
  const [selected, setSelected] = useState<AdminDispute | null>(null);
  const [action, setAction] = useState<ResolveAction>("split");
  const [refundAmount, setRefundAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("rentals")
        .select("id, renter_id, owner_id, dispute_reason, dispute_status, is_disputed, created_at, item:items!item_id(title)")
        .eq("is_disputed", true)
        .order("created_at", { ascending: false });

      if (filter === "open" || filter === "investigating") {
        q = q.or("dispute_status.is.null,dispute_status.eq.open");
      } else if (filter === "resolved") {
        q = q.in("dispute_status", ["resolved_refund", "resolved_payout"]);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rentalsData = data || [];
      const userIds = [...new Set(rentalsData.flatMap(r => [r.renter_id, r.owner_id]).filter(Boolean))] as string[];
      let profileMap = new Map<string, { full_name: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = new Map((profiles || []).map(p => [p.id, { full_name: p.full_name }]));
      }

      setDisputes(rentalsData.map(r => ({
        id: r.id,
        rental_id: r.id,
        filed_by: r.renter_id,
        filed_against: r.owner_id,
        dispute_type: r.dispute_reason || "User Dispute",
        description: r.dispute_reason || "No details provided",
        status: r.dispute_status || "open",
        resolution_notes: null,
        resolution_amount: null,
        created_at: r.created_at,
        renter: profileMap.get(r.renter_id),
        owner: profileMap.get(r.owner_id),
        item: r.item,
      })));
    } catch (error) {
      console.error("Error loading disputes:", error);
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter]);

  const resolve = async () => {
    if (!selected || !notes.trim()) {
      toast.error("Resolution notes required");
      return;
    }
    setSaving(true);
    const parsed = parseFloat(refundAmount || "0");
    const amount = Number.isNaN(parsed) ? 0 : parsed;

    try {
      await invokeAdminOperation({
        action: 'resolve_dispute',
        disputeId: selected.id,
        rentalId: selected.rental_id,
        resolutionNotes: notes,
        resolutionAmount: amount,
        resolutionSplit: { action, refund_to_renter: amount },
      });

      toast.success("Dispute resolved");
      setSelected(null);
      setNotes("");
      setRefundAmount("");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve dispute');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" /> Admin Disputes
            </h1>
            <p className="text-sm text-muted-foreground">Review and resolve user disputes</p>
          </div>
          <div className="flex gap-1">
            {(["open", "investigating", "resolved", "all"] as const).map((s) => (
              <Button className="rounded-xl capitalize" key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : disputes.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No disputes in this filter.</p>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <GlassCard key={d.id}>
                
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        {d.renter?.full_name || "User"} · {d.item?.title || "Unknown item"}
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        Rental <code>{d.rental_id.slice(0, 8)}</code> · {format(new Date(d.created_at), "PPp")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={d.status === "resolved" ? "default" : "secondary"} className="capitalize rounded-full">{d.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                
                
                  <p className="text-sm">{d.description}</p>
                  {d.resolution_notes ? (
                    <div className="text-sm bg-muted p-3 rounded border-l-4 border-primary">
                      <div className="font-semibold mb-1">Resolution</div>
                      <p>{d.resolution_notes}</p>
                      {d.resolution_amount != null && (
                        <p className="mt-1 text-muted-foreground">Refund to renter: RM {Number(d.resolution_amount).toFixed(2)}</p>
                      )}
                    </div>
                  ) : (
                    <Dialog open={selected?.id === d.id} onOpenChange={(o) => setSelected(o ? d : null)}>
                      <DialogTrigger asChild>
                        <Button className="rounded-xl" size="sm">Resolve</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve dispute</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-2">
                            {(["refund_renter", "split", "release_owner"] as ResolveAction[]).map((a) => (
                              <Button className="rounded-xl capitalize" key={a} variant={action === a ? "default" : "outline"} size="sm" onClick={() => setAction(a)}>
                                {a.replace(/_/g, " ")}
                              </Button>
                            ))}
                          </div>
                          {action !== "release_owner" && (
                            <div>
                              <Label>Refund amount (RM)</Label>
                              <Input className="rounded-xl"
                                type="number"
                                step="0.01"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          )}
                          <div>
                            <Label>Resolution notes (visible to both parties)</Label>
                            <Textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Explain the decision..."
                              rows={4}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button className="rounded-xl" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                          <Button className="rounded-xl" onClick={resolve} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Resolution
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
