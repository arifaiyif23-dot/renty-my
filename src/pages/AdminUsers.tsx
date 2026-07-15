import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Shield, ShieldOff, Loader2, Ban, CheckCircle, AlertTriangle, User as UserIcon } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { format } from "date-fns";
import { invokeAdminOperation } from "@/lib/adminOperations";
import type { Profile } from "@/types";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "moderator", label: "Moderator", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "user", label: "User", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<(Profile & { role?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [suspendUser, setSuspendUser] = useState<Profile | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url, is_verified, verification_level, is_suspended, trust_score, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);
      const enriched = (profiles || []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) || "user",
      }));

      setUsers(enriched);
    } catch (error: unknown) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSuspend = async () => {
    if (!suspendUser) return;
    setProcessing(suspendUser.id);
    try {
      await invokeAdminOperation({ action: 'suspend_user', userId: suspendUser.id, reason: suspendReason || 'No reason provided' });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === suspendUser.id
            ? { ...u, is_suspended: true, suspended_at: new Date().toISOString(), suspension_reason: suspendReason }
            : u
        )
      );
      toast.success("User suspended");
      setSuspendUser(null);
      setSuspendReason("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const handleUnsuspend = async (user: Profile) => {
    setProcessing(user.id);
    try {
      await invokeAdminOperation({ action: 'unsuspend_user', userId: user.id });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_suspended: false, suspended_at: undefined, suspension_reason: undefined } : u
        )
      );
      toast.success("User unsuspended");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = users.filter((u) => {
    const name = u.full_name?.toLowerCase() || "";
    const email = u.id?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    if (query && !name.includes(query) && !email.includes(query)) return false;
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (filterStatus === "suspended" && !u.is_suspended) return false;
    if (filterStatus === "active" && u.is_suspended) return false;
    if (filterStatus === "deleted" && !u.is_deleted) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage users, roles, and suspensions</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No users found
                </CardContent>
              </Card>
            ) : (
              filtered.map((u) => {
                const roleConfig = ROLE_OPTIONS.find((r) => r.value === u.role) || ROLE_OPTIONS[2];
                return (
                  <Card key={u.id} className={u.is_suspended ? "border-orange-300 dark:border-orange-800" : u.is_deleted ? "border-muted opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.avatar_url} />
                          <AvatarFallback>{(u.full_name || "U")[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{u.full_name || "Unnamed"}</span>
                            <Badge variant="outline" className={roleConfig.color}>
                              {roleConfig.label}
                            </Badge>
                            {u.is_verified && <Badge variant="secondary" className="text-xs">Verified</Badge>}
                            {u.is_suspended && <Badge variant="destructive" className="text-xs">Suspended</Badge>}
                            {u.is_deleted && <Badge variant="outline" className="text-xs">Deleted</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span>ID: {u.id.slice(0, 8)}...</span>
                            {u.location && <span>{u.location}</span>}
                            <span>Joined {format(new Date(u.created_at), "MMM yyyy")}</span>
                            {u.suspended_at && (
                              <span className="text-orange-500">
                                Suspended {format(new Date(u.suspended_at), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                          {u.suspension_reason && (
                            <p className="text-xs text-orange-500 mt-1">Reason: {u.suspension_reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {u.is_suspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnsuspend(u)}
                              disabled={processing === u.id}
                            >
                              {processing === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                              Unsuspend
                            </Button>
                          ) : !u.is_deleted ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setSuspendUser(u); setSuspendReason(""); }}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Suspend
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Suspend Dialog */}
      <Dialog open={!!suspendUser} onOpenChange={() => setSuspendUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Suspend User
            </DialogTitle>
            <DialogDescription>
              This will prevent {suspendUser?.full_name || "this user"} from using the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                The user will not be able to log in, rent items, or access their account.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for suspension</label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Explain why this user is being suspended..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={processing === suspendUser?.id}>
              {processing === suspendUser?.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
