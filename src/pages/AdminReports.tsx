import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { invokeAdminOperation } from "@/lib/adminOperations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Flag, Loader2, CheckCircle, XCircle, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { Report, ReportStatus } from "@/types";

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  investigating: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("reports")
        .select("*, reporter:reporter_id(full_name, avatar_url)")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (error: unknown) {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleAction = async (reportId: string, status: ReportStatus) => {
    setProcessing(reportId);
    try {
      await invokeAdminOperation({ action: 'resolve_report', reportId, status, resolutionNote: resolutionNote || undefined });

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status, resolution_note: resolutionNote } : r))
      );
      toast.success(`Report ${status}`);
      setSelectedReport(null);
      setResolutionNote("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    if (q && !r.reason.toLowerCase().includes(q) && !r.target_id.toLowerCase().includes(q) && !r.reporter?.full_name?.toLowerCase().includes(q)) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterType !== "all" && r.target_type !== filterType) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-6">
        <Flag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Reports Queue</h1>
          <p className="text-sm text-muted-foreground">Review and resolve user reports</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="item">Item</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="message">Message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No reports found</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((report) => (
            <Card key={report.id} className={`cursor-pointer hover:border-primary/50 transition-colors ${report.status === 'pending' ? 'border-yellow-300 dark:border-yellow-700' : ''}`}>
              <CardContent className="p-4" onClick={() => { setSelectedReport(report); setResolutionNote(report.resolution_note || ""); }}>
                <div className="flex items-start gap-3">
                  <Flag className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium capitalize">{report.reason}</span>
                      <Badge variant="outline" className="text-xs capitalize">{report.target_type}</Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[report.status]}`}>{report.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported by {report.reporter?.full_name || "Unknown"} · {format(new Date(report.created_at), "MMM d, yyyy HH:mm")}
                      · Target: {report.target_id.slice(0, 12)}...
                    </p>
                    {report.description && (
                      <p className="text-sm mt-2 text-muted-foreground line-clamp-2">{report.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" />
              Report Details
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Reason</p>
                  <p className="font-medium capitalize">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target Type</p>
                  <p className="font-medium capitalize">{selectedReport.target_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target ID</p>
                  <p className="font-medium text-xs break-all">{selectedReport.target_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[selectedReport.status]}>{selectedReport.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Reporter</p>
                  <p>{selectedReport.reporter?.full_name || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedReport.created_at), "MMM d, yyyy HH:mm")}</p>
                </div>
              </div>

              {selectedReport.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedReport.description}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Resolution Note</p>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Add a note about the resolution..."
                  rows={2}
                />
              </div>

              {selectedReport.status === 'pending' || selectedReport.status === 'investigating' ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(selectedReport.id, 'investigating')}
                    disabled={processing === selectedReport.id}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Investigate
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(selectedReport.id, 'resolved')}
                    disabled={processing === selectedReport.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Resolve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction(selectedReport.id, 'dismissed')}
                    disabled={processing === selectedReport.id}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Report {selectedReport.status} on {format(new Date(selectedReport.updated_at), "MMM d, yyyy HH:mm")}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
