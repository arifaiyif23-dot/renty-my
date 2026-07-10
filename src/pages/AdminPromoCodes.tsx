import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeAdminOperation } from "@/lib/adminOperations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TicketPercent, Loader2, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import type { PromoCode } from "@/types";

export default function AdminPromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "", discount_amount: "", discount_type: "percentage" as "percentage" | "fixed",
    max_uses: "", valid_from: "", valid_until: "",
  });

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCodes(data || []);
    } catch { toast.error("Failed to load promo codes"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const toggleActive = async (code: PromoCode) => {
    try {
      await invokeAdminOperation({ action: 'toggle_promo_code', id: code.id, isActive: !code.is_active });
      setCodes((prev) => prev.map((c) => c.id === code.id ? { ...c, is_active: !c.is_active } : c));
    } catch { toast.error("Failed to update"); }
  };

  const handleCreate = async () => {
    if (!form.code.trim() || !form.discount_amount) { toast.error("Code and discount required"); return; }
    setSaving(true);
    try {
      await invokeAdminOperation({
        action: 'create_promo_code',
        code: form.code.trim().toUpperCase(),
        discountAmount: parseFloat(form.discount_amount),
        discountType: form.discount_type,
        maxUses: form.max_uses ? parseInt(form.max_uses) : undefined,
        validFrom: form.valid_from || undefined,
        validUntil: form.valid_until || undefined,
      });
      toast.success("Promo code created");
      setShowCreate(false);
      setForm({ code: "", discount_amount: "", discount_type: "percentage", max_uses: "", valid_from: "", valid_until: "" });
      loadCodes();
    } catch (err: any) { toast.error(err.message || "Failed to create"); }
    finally { setSaving(false); }
  };

  const filtered = codes.filter((c) => {
    const q = search.toLowerCase();
    if (q && !c.code.toLowerCase().includes(q)) return false;
    if (filterActive === "active" && !c.is_active) return false;
    if (filterActive === "inactive" && c.is_active) return false;
    return true;
  });

  const stats = {
    total: codes.length,
    active: codes.filter((c) => c.is_active).length,
    totalUses: codes.reduce((s, c) => s + c.current_uses, 0),
  };

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-6">
        <TicketPercent className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Promo Codes</h1>
          <p className="text-sm text-muted-foreground">Create and manage discount codes</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">Total Codes</CardTitle><p className="text-3xl font-bold">{stats.total}</p></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle><p className="text-3xl font-bold text-green-600">{stats.active}</p></CardHeader></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">Total Uses</CardTitle><p className="text-3xl font-bold">{stats.totalUses}</p></CardHeader></Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search codes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No promo codes found</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((code) => (
            <Card key={code.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{code.code}</span>
                      <Badge variant={code.is_active ? "default" : "secondary"}>
                        {code.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{code.discount_type === 'percentage' ? `${code.discount_amount}% off` : `RM ${code.discount_amount} off`}</span>
                      <span>Used: {code.current_uses}{code.max_uses ? `/${code.max_uses}` : ""}</span>
                      {code.valid_until && <span>Expires: {format(new Date(code.valid_until), "MMM d, yyyy")}</span>}
                      <span>Created: {format(new Date(code.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <Switch checked={code.is_active} onCheckedChange={() => toggleActive(code)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Promo Code</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SUMMER50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={form.discount_type} onValueChange={(v: "percentage" | "fixed") => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (RM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount Amount</label>
                <Input type="number" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} placeholder={form.discount_type === 'percentage' ? "e.g. 50" : "e.g. 10.00"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Uses (optional)</label>
                <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Valid From (optional)</label>
                <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valid Until (optional)</label>
                <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
