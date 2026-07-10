import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { DollarSign, Loader2, TrendingUp, Clock, CheckCircle, XCircle, CreditCard, PlusCircle, Download, Shield } from 'lucide-react';
import Header from '@/components/Header';
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
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select('*')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;
      setPayouts(payoutsData || []);

      // Calculate stats
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

      // Fetch bank account
      const { data: bankData, error: bankError } = await supabase
        .from('owner_bank_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      // Mask account number for display
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
    if (!/^\d{6,20}$/.test(bankForm.account_number.replace(/\s/g, ''))) {
      toast.error('Account number must be 6-20 digits');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user?.id,
        ...bankForm
      };

      if (bankAccount) {
        // Update existing
        const { error } = await supabase
          .from('owner_bank_accounts')
          .update(bankForm)
          .eq('user_id', user?.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('owner_bank_accounts')
          .insert([payload]);

        if (error) throw error;
      }

      toast.success('Bank account details saved successfully');
      setShowBankDialog(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      toast.error(error.message || 'Failed to save bank account');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      held: { label: 'Held Until Complete', variant: 'secondary' as const, icon: Clock },
      awaiting_bank_details: { label: 'Add Bank Account', variant: 'secondary' as const, icon: XCircle },
      pending: { label: 'Processing', variant: 'default' as const, icon: Clock },
      completed: { label: 'Paid', variant: 'default' as const, icon: CheckCircle },
      failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'default' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
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
            <Button variant="outline" size="sm" onClick={() => exportCsv(payouts)} disabled={payouts.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
            <DialogTrigger asChild>
              <Button variant={bankAccount ? "outline" : "default"}>
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
                  />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    placeholder="1234567890"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="account_holder">Account Holder Name</Label>
                  <Input
                    id="account_holder"
                    placeholder="As per bank account"
                    value={bankForm.account_holder_name}
                    onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBankDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveBankAccount} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Bank Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Bank Account Warning */}
        {!bankAccount && stats.pendingPayouts > 0 && (
          <Card className="mb-6 border-orange-500/50 bg-orange-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Bank Account Required</h3>
                  <p className="text-sm text-muted-foreground">
                    You have pending payouts! Add your bank account details now to receive payments.
                  </p>
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setShowBankDialog(true)}
                  >
                    Add Bank Account Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Total Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats.totalEarnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" /> Held in Escrow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats.heldAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Released ~3 days after rental ends</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pending Payout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats.pendingAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.pendingPayouts} in queue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats.paidAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.completedPayouts} completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Current Bank Account */}
        {bankAccount && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Bank Account Details
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Payouts List */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>
              All payouts from completed rentals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <EnhancedEmptyState
                icon={DollarSign}
                title="No payouts yet"
                description="Payouts are created automatically when rentals complete"
              />
            ) : (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div>
                          <div className="font-semibold">RM {parseFloat(payout.payout_amount.toString()).toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">
                            Rental: RM {parseFloat(payout.rental_amount.toString()).toFixed(2)} - Fee: RM {parseFloat(payout.platform_fee.toString()).toFixed(2)}
                          </div>
                        </div>
                        {getStatusBadge(payout.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Created: {format(new Date(payout.created_at), 'PPp')}</p>
                        {payout.processed_at && (
                          <p>Processed: {format(new Date(payout.processed_at), 'PPp')}</p>
                        )}
                        {payout.bank_name && (
                          <p>Bank: {payout.bank_name} - {payout.account_number}</p>
                        )}
                        {payout.failure_reason && (
                          <p className="text-destructive">Reason: {payout.failure_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
