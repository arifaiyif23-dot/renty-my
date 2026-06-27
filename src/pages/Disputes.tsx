import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import EnhancedEmptyState from "@/components/EnhancedEmptyState";
import { format } from "date-fns";

interface Dispute {
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
  resolved_at: string | null;
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "resolved" || s === "closed") return "default";
  if (s === "escalated") return "destructive";
  return "secondary";
};

export default function Disputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .or(`filed_by.eq.${user.id},filed_against.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!error) setDisputes((data as unknown as Dispute[]) || []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> My Disputes
          </h1>
          <p className="text-sm text-muted-foreground">All disputes you've filed or that involve you</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : disputes.length === 0 ? (
          <EnhancedEmptyState
            icon={ShieldAlert}
            title="No disputes"
            description="You haven't filed or been involved in any disputes. Disputes can be opened from a completed rental if there's an issue."
          />
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
                        Filed {format(new Date(d.created_at), "PPp")}
                        {d.filed_by === user?.id ? " · by you" : " · against you"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{d.severity}</Badge>
                      <Badge variant={statusVariant(d.status)} className="capitalize">{d.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{d.description}</p>
                  {d.evidence_urls && d.evidence_urls.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {d.evidence_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                          <img src={url} alt={`Evidence ${i + 1}`} className="h-20 w-20 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  )}
                  {d.resolution_notes && (
                    <div className="text-sm bg-muted p-3 rounded border-l-4 border-primary">
                      <div className="font-semibold mb-1">Resolution</div>
                      <p>{d.resolution_notes}</p>
                      {d.resolution_amount != null && (
                        <p className="mt-1 text-muted-foreground">Refund: RM {Number(d.resolution_amount).toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
