import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { invokeAdminOperation } from '@/lib/adminOperations';
import { toast } from 'sonner';
import { Loader2, Shield, ShieldCheck, UserPlus, Trash2, Crown, Users } from 'lucide-react';

const ALL_PERMISSIONS = [
  { key: 'verification.verify', label: 'Verify Identity' },
  { key: 'verification.batch_verify', label: 'Batch Verify' },
  { key: 'fraud.manage', label: 'Manage Fraud' },
  { key: 'user.suspend', label: 'Suspend Users' },
  { key: 'disputes.resolve', label: 'Resolve Disputes' },
  { key: 'promos.manage', label: 'Manage Promos' },
  { key: 'settings.manage', label: 'Platform Settings' },
  { key: 'payouts.process', label: 'Process Payouts' },
  { key: 'reports.resolve', label: 'Resolve Reports' },
  { key: 'payments.cleanup', label: 'Cleanup Payments' },
  { key: 'admin.logs', label: 'View Audit Logs' },
];

interface AdminUser {
  userId: string;
  role: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  permissions: string[];
  createdAt: string;
}

export default function AdminManageAdmins() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [savingPerms, setSavingPerms] = useState<Record<string, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState<AdminUser | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const data = await invokeAdminOperation({ action: 'list_admins' });
      setAdmins(data.admins || []);
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await invokeAdminOperation({
        action: 'assign_admin_role',
        email: newEmail.trim(),
        permissions: newPermissions,
      });
      toast.success('Admin added successfully');
      setNewEmail('');
      setNewPermissions([]);
      await fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAdding(false);
    }
  };

  const handleTogglePermission = async (userId: string, permission: string, currentPerms: string[]) => {
    const newPerms = currentPerms.includes(permission)
      ? currentPerms.filter((p) => p !== permission)
      : [...currentPerms, permission];

    setSavingPerms((prev) => ({ ...prev, [userId]: true }));
    try {
      await invokeAdminOperation({
        action: 'update_admin_permissions',
        userId,
        permissions: newPerms,
      });
      setAdmins((prev) =>
        prev.map((a) => (a.userId === userId ? { ...a, permissions: newPerms } : a))
      );
    } catch {
      toast.error('Failed to update permissions');
    } finally {
      setSavingPerms((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemoveAdmin = async (admin: AdminUser) => {
    try {
      await invokeAdminOperation({ action: 'remove_admin_role', userId: admin.userId });
      toast.success('Admin removed');
      setAdmins((prev) => prev.filter((a) => a.userId !== admin.userId));
    } catch {
      toast.error('Failed to remove admin');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Manage Admins</h1>
            <p className="text-sm text-muted-foreground">Manage admin roles and permissions</p>
          </div>
        </div>

        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Add New Admin</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Email Address</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Permissions</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={newPermissions.includes(perm.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewPermissions((prev) => [...prev, perm.key]);
                        } else {
                          setNewPermissions((prev) => prev.filter((p) => p !== perm.key));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleAddAdmin} disabled={adding || !newEmail.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add Admin
            </Button>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Current Admins</h2>
          </div>
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No admins found</p>
          ) : (
            <div className="space-y-4">
              {admins.map((admin, idx) => {
                const isSuperAdmin = admin.role === 'super_admin';
                const isSaving = savingPerms[admin.userId];
                return (
                  <div key={admin.userId}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          {admin.avatarUrl ? (
                            <AvatarImage src={admin.avatarUrl} alt={admin.fullName} />
                          ) : null}
                          <AvatarFallback>
                            {admin.fullName?.charAt(0)?.toUpperCase() || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{admin.fullName || 'Unknown'}</span>
                            <Badge variant={isSuperAdmin ? 'default' : 'secondary'} className="shrink-0">
                              {isSuperAdmin ? (
                                <><Crown className="h-3 w-3 mr-1" />Super Admin</>
                              ) : (
                                <><Shield className="h-3 w-3 mr-1" />Admin</>
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{admin.email}</p>
                        </div>
                      </div>
                      {!isSuperAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmRemove(admin)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                    {!isSuperAdmin && (
                      <div className="mt-3 ml-12 pl-12">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Permissions</p>
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                          {ALL_PERMISSIONS.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded-md hover:bg-muted/50"
                            >
                              <Switch
                                checked={admin.permissions.includes(perm.key)}
                                onCheckedChange={() =>
                                  handleTogglePermission(admin.userId, perm.key, admin.permissions)
                                }
                                disabled={isSaving}
                              />
                              <span className="text-xs">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
      <Dialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Admin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove {confirmRemove?.fullName || confirmRemove?.email || 'this user'} as admin?
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl" onClick={() => { if (confirmRemove) handleRemoveAdmin(confirmRemove); setConfirmRemove(null); }}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
