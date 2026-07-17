import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/AdminLayout";
import { format } from "date-fns";
import { CalendarCheck, Loader2, Filter } from "lucide-react";

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
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
  { value: "disputed", label: "Disputed" },
];

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  pending_approval: { class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Pending" },
  approved: { class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Approved" },
  paid: { class: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", label: "Paid" },
  active: { class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Active" },
  completed: { class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", label: "Completed" },
  cancelled: { class: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Cancelled" },
  rejected: { class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Rejected" },
  disputed: { class: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", label: "Disputed" },
};

export default function AdminRentals() {
  const [rentals, setRentals] = useState<AdminRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, disputed: 0 });

  useEffect(() => {
    fetchRentals();
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

      const { count: total } = await supabase.from("rentals").select("*", { count: "exact", head: true });
      const { count: active } = await supabase.from("rentals").select("*", { count: "exact", head: true }).in("status", ["paid", "active", "approved"]);
      const { count: completed } = await supabase.from("rentals").select("*", { count: "exact", head: true }).eq("status", "completed");
      const { count: disputed } = await supabase.from("rentals").select("*", { count: "exact", head: true }).eq("is_disputed", true);

      setStats({
        total: total || 0,
        active: active || 0,
        completed: completed || 0,
        disputed: disputed || 0,
      });
    } catch (error) {
      console.error("Error fetching rentals:", error);
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Rentals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disputed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.disputed}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[250px]">
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
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rentals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No rentals found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rentals.map((rental) => {
              const sb = STATUS_BADGE[rental.status] || { class: "", label: rental.status };
              return (
                <Card key={rental.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={sb.class}>{sb.label}</Badge>
                          {rental.is_disputed && (
                            <Badge variant="destructive" className="text-xs">Disputed</Badge>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
