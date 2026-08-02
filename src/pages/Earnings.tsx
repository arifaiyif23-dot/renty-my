import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { DollarSign, Loader2, TrendingUp, Clock, CheckCircle, XCircle, CreditCard, PlusCircle, Download, Shield } from 'lucide-react';
import { PageLayout } from "@/components/PageLayout";
import { SkeletonV2 } from '@/components/SkeletonV2';
import { EmptyStateV2 } from '@/components/EmptyStateV2';
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
const { t } = useTranslation();
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
      toast.error(t('earnings.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder_name) {
      toast.error(t('earnings.fillBankDetails'));
      return;
    }
    const isMaskedNumber = bankForm.account_number.includes('****');
    if (!isMaskedNumber && !/^\d{6,20}$/.test(bankForm.account_number.replace(/\s/g, ''))) {
      toast.error(t('earnings.invalidAccountNumber'));
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

      toast.success(t('earnings.savedBank'));
      setShowBankDialog(false);
      fetchData();
    } catch (error: unknown) {
      console.error('Error saving bank account:', error);
      toast.error(error instanceof Error ? error.message : t('earnings.error'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
      held: { variant: 'secondary', icon: Clock },
      awaiting_bank_details: { variant: 'secondary', icon: XCircle },
      pending: { variant: 'default', icon: Clock },
      completed: { variant: 'default', icon: CheckCircle },
      failed: { variant: 'destructive', icon: XCircle },
    };

    const config = statusConfig[status] || { variant: 'default' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1 rounded-full">
        <Icon className="h-3 w-3" />
        {t(`earnings.status.${status}`, status)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="">
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
      </PageLayout>
    );
  }

  return (
    <PageLayout>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-8 w-8" />
              {t('earnings.title')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('earnings.subtitle')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => exportCsv(payouts)} disabled={payouts.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {t('earnings.exportCsv')}
            </Button>
          <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
            <DialogTrigger asChild>
              <Button variant={bankAccount ? "outline" : "default"} className="rounded-lg">
                {bankAccount ? <CreditCard className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {bankAccount ? t('earnings.updateBank') : t('earnings.addBank')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('earnings.bankTitle')}</DialogTitle>
                <DialogDescription>
                  {t('earnings.bankDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bank_name">{t('earnings.bankName')}</Label>
                  <Input
                    id="bank_name"
                    placeholder={t('earnings.bankNamePlaceholder')}
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="account_number">{t('earnings.accountNumber')}</Label>
                  <Input
                    id="account_number"
                    placeholder={t('earnings.accountNumberPlaceholder')}
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="account_holder">{t('earnings.accountHolder')}</Label>
                  <Input
                    id="account_holder"
                    placeholder={t('earnings.accountHolderPlaceholder')}
                    value={bankForm.account_holder_name}
                    onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-lg" onClick={() => setShowBankDialog(false)}>{t('common.cancel')}</Button>
                <Button className="rounded-lg" onClick={handleSaveBankAccount} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('earnings.saveBank')}
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
                <h3 className="font-semibold mb-1">{t('earnings.bankRequired')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('earnings.bankRequiredDesc')}
                </p>
                <Button
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={() => setShowBankDialog(true)}
                >
                  {t('earnings.addBankNow')}
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> {t('earnings.totalEarnings')}
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('earnings.allTime')}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <Shield className="h-3 w-3" /> {t('earnings.heldInEscrow')}
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.heldAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('earnings.heldDesc')}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {t('earnings.pendingPayout')}
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.pendingAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('earnings.inQueue', { count: stats.pendingPayouts })}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> {t('earnings.paidOut')}
              </p>
              <p className="text-2xl font-bold tabular-nums">RM {stats.paidAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('earnings.completedCount', { count: stats.completedPayouts })}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          </GlassCard>
        </div>

        {bankAccount && (
          <GlassCard padding="lg" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">{t('earnings.bankTitle')}</h2>
            </div>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('earnings.bankNameLabel')}</span>
                <span className="font-semibold">{bankAccount.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('earnings.accountNumberLabel')}</span>
                <span className="font-mono">{bankAccount.account_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('earnings.accountHolderLabel')}</span>
                <span className="font-semibold">{bankAccount.account_holder_name}</span>
              </div>
            </div>
          </GlassCard>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">{t('earnings.payoutHistory')}</h2>
              <p className="text-sm text-muted-foreground">{t('earnings.payoutHistoryDesc')}</p>
            </div>
            <Badge variant="outline" className="rounded-full">{t('earnings.total', { count: payouts.length })}</Badge>
          </div>
          {payouts.length === 0 ? (
            <GlassCard padding="lg">
              <EmptyStateV2
                icon={DollarSign}
                title={t('earnings.noPayouts')}
                description={t('earnings.noPayoutsDesc')}
                actionLabel={t('earnings.browseItems')}
                onAction={() => navigate('/search')}
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
                        {t('earnings.rentalFee', { rental: parseFloat(payout.rental_amount.toString()).toFixed(2), fee: parseFloat(payout.platform_fee.toString()).toFixed(2) })}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <p>{t('earnings.created')} {format(new Date(payout.created_at), 'PPp')}</p>
                        {payout.processed_at && (
                          <p>{t('earnings.processed')} {format(new Date(payout.processed_at), 'PPp')}</p>
                        )}
                        {payout.bank_name && (
                          <p>{t('earnings.bank')} {payout.bank_name} — {payout.account_number ? '****' + payout.account_number.slice(-4) : t('earnings.na')}</p>
                        )}
                        {payout.failure_reason && (
                          <p className="text-destructive">{t('earnings.reason')} {payout.failure_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
    </PageLayout>
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
