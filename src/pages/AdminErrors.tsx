import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bug, RefreshCw, Loader2, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { toast } from "sonner";

type ErrorRow = {
  id: string;
  user_id: string | null;
  error_type: string;
  error_message: string;
  error_stack: string | null;
  component_stack: string | null;
  url: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default function AdminErrors() {
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (typeFilter) {
        query = query.eq("error_type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setErrors((data ?? []) as ErrorRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load errors");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const deleteError = async (id: string) => {
    try {
      const { error } = await supabase.from("errors").delete().eq("id", id);
      if (error) throw error;
      setErrors((prev) => prev.filter((e) => e.id !== id));
      toast.success("Error deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const clearAll = async () => {
    try {
      const { error } = await supabase.from("errors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setErrors([]);
      toast.success("All errors cleared");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to clear");
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = errors.filter(
    (e) =>
      !search ||
      e.error_message.toLowerCase().includes(search.toLowerCase()) ||
      e.url?.toLowerCase().includes(search.toLowerCase())
  );

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      runtime: "bg-red-100 text-red-800",
      promise: "bg-yellow-100 text-yellow-800",
      boundary: "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const types = useMemo(() => [...new Set(errors.map((e) => e.error_type))], [errors]);

  if (loading && errors.length === 0) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Error Log</h1>
            <p className="text-sm text-muted-foreground">
              {errors.length} error{errors.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="rounded-lg" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button className="rounded-lg" variant="destructive" onClick={() => setConfirmClearAll(true)} disabled={errors.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all
            </Button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Search by message or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs rounded-lg"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="card-base rounded-lg">
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Bug className="h-12 w-12 mb-3" />
              <p>No errors found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((err) => (
              <div className="card-base rounded-lg" key={err.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={typeBadge(err.error_type)}>{err.error_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(err.created_at).toLocaleString()}
                      </span>
                      {err.url && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={err.url}>
                          {err.url}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium break-words">{err.error_message}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleExpand(err.id)} aria-label="Toggle details">
                    {expanded.has(err.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteError(err.id)} aria-label="Delete error">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {expanded.has(err.id) && (
                  <div className="mt-3 space-y-3 text-xs border-t pt-3">
                    {err.error_stack && (
                      <div>
                        <p className="font-medium mb-1 text-muted-foreground">Stack trace:</p>
                        <pre className="bg-muted p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap font-mono text-xs">
                          {err.error_stack}
                        </pre>
                      </div>
                    )}
                    {err.component_stack && (
                      <div>
                        <p className="font-medium mb-1 text-muted-foreground">Component stack:</p>
                        <pre className="bg-muted p-3 rounded overflow-auto max-h-32 whitespace-pre-wrap font-mono text-xs">
                          {err.component_stack}
                        </pre>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      {err.user_id && <div><span className="font-medium">User ID:</span> {err.user_id}</div>}
                      {err.user_agent && (
                        <div className="col-span-2">
                          <span className="font-medium">User Agent:</span> {err.user_agent}
                        </div>
                      )}
                      {Object.keys(err.metadata).length > 0 && (
                        <div className="col-span-2">
                          <span className="font-medium">Metadata:</span>{" "}
                          <pre className="inline bg-muted px-1 rounded">{JSON.stringify(err.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Errors?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all error records. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setConfirmClearAll(false)}>Cancel</Button>
            <Button variant="destructive" className="rounded-lg" onClick={() => { setConfirmClearAll(false); clearAll(); }}>Delete All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
