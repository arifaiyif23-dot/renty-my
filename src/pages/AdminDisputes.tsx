import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  severity: string;
  description: string;
  evidence_urls: string[] | null;
  status: string;
  resolution_notes: string | null;
  resolution_amount: number | null;
  created_at: string;
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
    let q = supabase.from("disputes").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setDisputes((data as unknown as AdminDispute[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const resolve = async () => {
    if (!selected || !notes.trim()) {
      toast.error("Resolution notes required");
      return;
    }
    setSaving(true);
    const amount = action === "release_owner" ? 0 : parseFloat(refundAmount || "0");

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
    setSaving(false);
    setNotes("");
    setRefundAmount("");
    load();
  };

  return (
    <AdminLayout>
      <main className="px-4 py-6 max-w-6xl">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" /> Admin Disputes
            </h1>
            <p className="text-sm text-muted-foreground">Review and resolve user disputes</p>
          </div>
          <div className="flex gap-1">
            {(["open", "investigating", "resolved", "all"] as const).map((s) => (
              <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">
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
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base capitalize flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        {d.dispute_type.replace(/_/g, " ")}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Rental <code>{d.rental_id.slice(0, 8)}</code> · {format(new Date(d.created_at), "PPp")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{d.severity}</Badge>
                      <Badge variant={d.status === "resolved" ? "default" : "secondary"} className="capitalize">{d.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{d.description}</p>
                  {d.evidence_urls && d.evidence_urls.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {d.evidence_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Evidence ${i + 1}`} className="h-20 w-20 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  )}
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
                        <Button size="sm">Resolve</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve dispute</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-2">
                            {(["refund_renter", "split", "release_owner"] as ResolveAction[]).map((a) => (
                              <Button key={a} variant={action === a ? "default" : "outline"} size="sm" onClick={() => setAction(a)} className="capitalize">
                                {a.replace(/_/g, " ")}
                              </Button>
                            ))}
                          </div>
                          {action !== "release_owner" && (
                            <div>
                              <Label>Refund amount (RM)</Label>
                              <Input
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
                          <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                          <Button onClick={resolve} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Resolution
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
