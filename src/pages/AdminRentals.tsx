import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/AdminLayout";
import { format } from "date-fns";
import { CalendarCheck, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";

interface AdminRental {
  id: string;
  status: string;
  total_price: number;
  start_date: string;
  end_date: string;
  created_at: string;
  is_disputed: boolean | null;
  item: { title: string } | null;
  renter: { full_name: string } | null;
  owner: { full_name: string } | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
  { value: "disputed", label: "Disputed" },
];

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  pending_approval: { class: "bg-warning/10 text-warning", label: "Pending" },
  approved: { class: "bg-primary/10 text-primary-foreground", label: "Approved" },
  paid: { class: "bg-primary/10 text-primary-foreground", label: "Paid" },
  active: { class: "bg-success/10 text-success-foreground", label: "Active" },
  completed: { class: "bg-success/10 text-success-foreground", label: "Completed" },
  cancelled: { class: "bg-muted text-muted-foreground", label: "Cancelled" },
  rejected: { class: "bg-destructive/10 text-destructive-foreground", label: "Rejected" },
  disputed: { class: "bg-warning/10 text-warning", label: "Disputed" },
};

export default function AdminRentals() {
  const [rentals, setRentals] = useState<AdminRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, disputed: 0 });

  useEffect(() => {
    fetchRentals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchRentals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("rentals")
        .select("id, status, total_price, start_date, end_date, created_at, is_disputed, item:items!item_id(title), renter:profiles!renter_id(full_name), owner:profiles!owner_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRentals(data || []);

      const [totalRes, activeRes, completedRes, disputedRes] = await Promise.all([
        supabase.from("rentals").select("*", { count: "exact", head: true }),
        supabase.from("rentals").select("*", { count: "exact", head: true }).in("status", ["paid", "active", "approved"]),
        supabase.from("rentals").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("rentals").select("*", { count: "exact", head: true }).eq("is_disputed", true),
      ]);

      setStats({
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        completed: completedRes.count || 0,
        disputed: disputedRes.count || 0,
      });
    } catch (err) {
      console.error("Error fetching rentals:", err);
      toast.error("Failed to load rentals");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Rental Management</h1>
            <p className="text-sm text-muted-foreground">View and monitor all rental transactions</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <GlassCard padding="md">
            <p className="text-sm text-muted-foreground mb-1">Total Rentals</p>
            <div className="text-2xl font-bold">{stats.total}</div>
          </GlassCard>
          <GlassCard padding="md">
            <p className="text-sm text-muted-foreground mb-1">Active</p>
            <div className="text-2xl font-bold text-success">{stats.active}</div>
          </GlassCard>
          <GlassCard padding="md">
            <p className="text-sm text-muted-foreground mb-1">Completed</p>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </GlassCard>
          <GlassCard padding="md">
            <p className="text-sm text-muted-foreground mb-1">Disputed</p>
            <div className="text-2xl font-bold text-warning">{stats.disputed}</div>
          </GlassCard>
        </div>

        <GlassCard className="mb-6" padding="md">
          <div className="flex items-center gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[250px] rounded-lg">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rentals.length === 0 ? (
          <GlassCard padding="lg">
            <p className="text-center text-muted-foreground">No rentals found</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {rentals.map((rental) => {
              const sb = STATUS_BADGE[rental.status] || { class: "", label: rental.status };
              return (
                <GlassCard key={rental.id} padding="md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={sb.class}>{sb.label}</Badge>
                        {rental.is_disputed && (
                          <Badge variant="destructive" className="text-xs rounded-full">Disputed</Badge>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">{rental.item?.title || "Unknown item"}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span>Renter: {rental.renter?.full_name || "Unknown"}</span>
                        <span>Owner: {rental.owner?.full_name || "Unknown"}</span>
                        <span>RM{Number(rental.total_price).toFixed(2)}</span>
                        <span>{format(new Date(rental.start_date), "MMM d")} - {format(new Date(rental.end_date), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 text-right">
                      <div>{format(new Date(rental.created_at), "MMM d, yyyy")}</div>
                      <div className="text-[10px]">ID: {rental.id.slice(0, 8)}</div>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
