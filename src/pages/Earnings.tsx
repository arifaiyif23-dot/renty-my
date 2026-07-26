import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { DollarSign, Loader2, TrendingUp, Clock, CheckCircle, XCircle, CreditCard, PlusCircle, Download, Shield } from 'lucide-react';
import Header from '@/components/Header';
import { SkeletonV2 } from '@/components/SkeletonV2';
import EnhancedEmptyState from '@/components/EnhancedEmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from 'date-fns';

interface Payout {
  id: string;
  rental_id: string;
  rental_amount: number;
  platform_fee: number;
  payout_amount: number;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  created_at: string;
  processed_at: string | null;
  failure_reason: string | null;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  is_verified: boolean;
}

export default function Earnings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: ''
  });

  const [stats, setStats] = useState({
    totalEarnings: 0,
    heldAmount: 0,
    pendingAmount: 0,
    paidAmount: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = async () => {
    if (!mountedRef.current) return;
    try {
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select('id, payout_amount, status, created_at')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;
      setPayouts(payoutsData || []);

      const sumBy = (status: string) =>
        (payoutsData || [])
          .filter((p) => p.status === status)
          .reduce((s, p) => s + parseFloat(p.payout_amount.toString()), 0);

      const heldAmount = sumBy('held') + sumBy('awaiting_bank_details');
      const pendingAmount = sumBy('pending') + sumBy('processing');
      const paidAmount = sumBy('completed');
      const total = heldAmount + pendingAmount + paidAmount;

      setStats({
        totalEarnings: total,
        heldAmount,
        pendingAmount,
        paidAmount,
        pendingPayouts: (payoutsData || []).filter((p) => p.status === 'pending').length,
        completedPayouts: (payoutsData || []).filter((p) => p.status === 'completed').length,
      });

      const { data: bankData, error: bankError } = await supabase
        .from('owner_bank_accounts')
        .select('id, account_number, bank_name, account_holder_name')
        .eq('user_id', user?.id)
        .single();

      if (bankData) {
        const { data: masked } = await supabase.rpc('mask_account_number', {
          account_number: bankData.account_number
        });
        if (masked) {
          bankData.account_number = masked;
        }
      }

      if (bankError && bankError.code !== 'PGRST116') throw bankError;
      setBankAccount(bankData);

      if (bankData) {
        setBankForm({
          bank_name: bankData.bank_name,
          account_number: bankData.account_number,
          account_holder_name: bankData.account_holder_name
        });
      }

    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder_name) {
      toast.error('Please fill in all bank details');
      return;
    }
    const isMaskedNumber = bankForm.account_number.includes('****');
    if (!isMaskedNumber && !/^\d{6,20}$/.test(bankForm.account_number.replace(/\s/g, ''))) {
      toast.error('Account number must be 6-20 digits');
      return;
    }

    setSaving(true);
    try {
      // Don't write back the masked account number; only update it when the user
      // entered a new full (non-masked) number.
      const formToSave = isMaskedNumber
        ? { bank_name: bankForm.bank_name, account_holder_name: bankForm.account_holder_name }
        : bankForm;

      if (bankAccount) {
        const { error } = await supabase
          .from('owner_bank_accounts')
          .update(formToSave)
          .eq('user_id', user?.id);

        if (error) throw error;
      } else {
        const payload = {
          user_id: user?.id,
          ...formToSave
        };
        const { error } = await supabase
          .from('owner_bank_accounts')
          .insert([payload]);

        if (error) throw error;
      }

      toast.success('Bank account details saved successfully');
      setShowBankDialog(false);
      fetchData();
    } catch (error: unknown) {
      console.error('Error saving bank account:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
      held: { label: 'Held Until Complete', variant: 'secondary', icon: Clock },
      awaiting_bank_details: { label: 'Add Bank Account', variant: 'secondary', icon: XCircle },
      pending: { label: 'Processing', variant: 'default', icon: Clock },
      completed: { label: 'Paid', variant: 'default', icon: CheckCircle },
      failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
    };

    const config = statusConfig[status] || { label: status, variant: 'default' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1 rounded-full">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 pb-mobile-nav md:pb-8">
          <div className="flex items-center gap-3 mb-8">
            <SkeletonV2 variant="circular" className="h-10 w-10" />
            <div className="space-y-2">
              <SkeletonV2 variant="text" className="h-7 w-40" />
              <SkeletonV2 variant="text" className="h-4 w-56" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => <SkeletonV2 key={i} variant="card" className="h-24" />)}
          </div>
          <SkeletonV2 variant="card" className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 pb-mobile-nav md:pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-8 w-8" />
              My Earnings
            </h1>
            <p className="text-muted-foreground mt-2">
              Track your rental earnings and manage payouts
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => exportCsv(payouts)} disabled={payouts.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
            <DialogTrigger asChild>
              <Button variant={bankAccount ? "outline" : "default"} className="rounded-xl">
                {bankAccount ? <CreditCard className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {bankAccount ? 'Update Bank Account' : 'Add Bank Account'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bank Account Details</DialogTitle>
                <DialogDescription>
                  Add your bank account to receive payouts automatically
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    placeholder="e.g., Maybank, CIMB, Public Bank"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    placeholder="1234567890"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="account_holder">Account Holder Name</Label>
                  <Input
                    id="account_holder"
                    placeholder="As per bank account"
                    value={bankForm.account_holder_name}
                    onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setShowBankDialog(false)}>Cancel</Button>
                <Button className="rounded-xl" onClick={handleSaveBankAccount} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Bank Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {!bankAccount && stats.pendingPayouts > 0 && (
          <GlassCard variant="subtle" padding="lg" className="mb-6">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Bank Account Required</h3>
                <p className="text-sm text-muted-foreground">
                  You have pending payouts! Add your bank account details now to receive payments.
                </p>
                <Button
                  size="sm"
                  className="mt-3 rounded-xl"
                  onClick={() => setShowBankDialog(true)}
                >
                  Add Bank Account Now
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Total Earnings
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">All time</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Held in Escrow
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.heldAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Released ~3 days after rental ends</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pending Payout
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.pendingAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.pendingPayouts} in queue</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Paid Out
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.paidAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.completedPayouts} completed</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-sky-500" />
            </div>
          </GlassCard>
        </div>

        {bankAccount && (
          <GlassCard padding="lg" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Bank Account Details</h2>
            </div>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank Name:</span>
                <span className="font-semibold">{bankAccount.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Number:</span>
                <span className="font-mono">{bankAccount.account_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Holder:</span>
                <span className="font-semibold">{bankAccount.account_holder_name}</span>
              </div>
            </div>
          </GlassCard>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Payout History</h2>
              <p className="text-sm text-muted-foreground">All payouts from completed rentals</p>
            </div>
            <Badge variant="outline" className="rounded-full">{payouts.length} total</Badge>
          </div>
          {payouts.length === 0 ? (
            <GlassCard padding="lg">
              <EnhancedEmptyState
                icon={DollarSign}
                title="No payouts yet"
                description="Payouts are created automatically when rentals complete"
              />
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <GlassCard key={payout.id} variant="subtle" padding="md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-lg font-bold tabular-nums">RM {parseFloat(payout.payout_amount.toString()).toFixed(2)}</span>
                        {getStatusBadge(payout.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Rental: RM {parseFloat(payout.rental_amount.toString()).toFixed(2)} — Fee: RM {parseFloat(payout.platform_fee.toString()).toFixed(2)}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <p>Created: {format(new Date(payout.created_at), 'PPp')}</p>
                        {payout.processed_at && (
                          <p>Processed: {format(new Date(payout.processed_at), 'PPp')}</p>
                        )}
                        {payout.bank_name && (
                          <p>Bank: {payout.bank_name} — {payout.account_number ? '****' + payout.account_number.slice(-4) : 'N/A'}</p>
                        )}
                        {payout.failure_reason && (
                          <p className="text-destructive">Reason: {payout.failure_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function exportCsv(payouts: Payout[]) {
  const headers = ['Date', 'Rental ID', 'Rental Amount (RM)', 'Platform Fee (RM)', 'Payout Amount (RM)', 'Status', 'Bank', 'Processed At'];
  const rows = payouts.map((p) => [
    new Date(p.created_at).toISOString(),
    p.rental_id,
    Number(p.rental_amount).toFixed(2),
    Number(p.platform_fee).toFixed(2),
    Number(p.payout_amount).toFixed(2),
    p.status,
    p.bank_name || '',
    p.processed_at ? new Date(p.processed_at).toISOString() : '',
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `renty-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
