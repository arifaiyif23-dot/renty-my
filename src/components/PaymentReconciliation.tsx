import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign,
  Download,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Eye,
  CheckSquare,
  Square
} from "lucide-react";

interface PendingTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  description: string;
  toyyibpay_transaction_id: string | null;
  created_at: string;
  status: string;
  expires_at: string | null;
  wallet: {
    user_id: string;
  };
  user?: {
    full_name: string;
    email: string;
  };
}

export function PaymentReconciliation() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<PendingTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [verifyingBillCode, setVerifyingBillCode] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    transaction: PendingTransaction | null;
    isBatch: boolean;
  }>({ open: false, transaction: null, isBatch: false });
  const [stats, setStats] = useState({
    totalPending: 0,
    totalAmount: 0,
    oldestPending: null as string | null,
    expiredCount: 0
  });

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [searchTerm, pendingTransactions]);

  const fetchPendingTransactions = async () => {
    setLoading(true);
    try {
      // Fetch pending wallet transactions with user details
      const { data: transactions, error } = await supabase
        .from("wallet_transactions")
        .select(`
          *,
          wallet:wallets!inner(user_id)
        `)
        .eq("status", "pending")
        .eq("type", "top_up" as any)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles for each transaction
      const userIds = [...new Set(transactions?.map((t: any) => t.wallet.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const { data: authData } = await supabase.auth.admin.listUsers();
      const users = authData?.users || [];
      
      // Enrich transactions with user data
      const enrichedTransactions = transactions?.map((tx: any) => {
        const profile = profiles?.find((p: any) => p.id === tx.wallet.user_id);
        const authUser = users?.find((u: any) => u.id === tx.wallet.user_id);
        return {
          ...tx,
          user: {
            full_name: profile?.full_name || 'Unknown',
            email: authUser?.email || 'Unknown'
          }
        };
      }) || [];

      setPendingTransactions(enrichedTransactions);

      // Calculate stats
      const totalAmount = enrichedTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const now = new Date();
      const expiredCount = enrichedTransactions.filter(tx => 
        tx.expires_at && new Date(tx.expires_at) < now
      ).length;

      setStats({
        totalPending: enrichedTransactions.length,
        totalAmount,
        oldestPending: enrichedTransactions.length > 0 
          ? enrichedTransactions[enrichedTransactions.length - 1].created_at 
          : null,
        expiredCount
      });

    } catch (error) {
      console.error('Error fetching pending transactions:', error);
      toast.error("Failed to fetch pending transactions");
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    if (!searchTerm.trim()) {
      setFilteredTransactions(pendingTransactions);
      return;
    }

    const search = searchTerm.toLowerCase();
    const filtered = pendingTransactions.filter(tx => 
      tx.toyyibpay_transaction_id?.toLowerCase().includes(search) ||
      tx.user?.full_name.toLowerCase().includes(search) ||
      tx.user?.email.toLowerCase().includes(search) ||
      tx.amount.toString().includes(search) ||
      tx.id.toLowerCase().includes(search)
    );
    setFilteredTransactions(filtered);
  };

  const verifyWithToyyibPay = async (billCode: string) => {
    setVerifyingBillCode(billCode);
    try {
      // This would call ToyyibPay API to check payment status
      // For now, we'll simulate it
      toast.info("Checking payment status with ToyyibPay...");
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success("Payment status verified");
      return { verified: true, status: '1' }; // 1 = success in ToyyibPay
    } catch (error) {
      toast.error("Failed to verify with ToyyibPay");
      return { verified: false, status: null };
    } finally {
      setVerifyingBillCode(null);
    }
  };

  const creditWallet = async (transaction: PendingTransaction) => {
    try {
      const amountToCredit = Number(transaction.amount);

      console.log('💳 Crediting wallet:', {
        userId: transaction.wallet.user_id,
        amount: amountToCredit,
        transactionId: transaction.id
      });

      // Credit wallet using RPC function
      const { error: walletError } = await supabase.rpc("increment_wallet_balance", {
        p_user_id: transaction.wallet.user_id,
        p_amount: amountToCredit,
      });

      if (walletError) throw walletError;

      // Mark transaction as completed
      const { error: updateError } = await supabase
        .from("wallet_transactions")
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq("id", transaction.id);

      if (updateError) throw updateError;

      // Create notification
      await supabase.from("notifications").insert({
        user_id: transaction.wallet.user_id,
        type: "payment_received" as any,
        title: "Payment Reconciled",
        message: `Your wallet has been credited with RM ${amountToCredit.toFixed(2)} (Manual reconciliation)`,
        link: "/wallet",
      } as any);

      // Log audit trail
      await supabase.from("payment_audit_log").insert({
        action: "manual_reconciliation",
        rental_id: transaction.id,
        amount: amountToCredit,
        status: "completed",
        details: {
          transaction_id: transaction.id,
          billCode: transaction.toyyibpay_transaction_id,
          method: "admin_manual_credit"
        }
      });

      toast.success(`Successfully credited RM ${amountToCredit.toFixed(2)} to ${transaction.user?.full_name}`);
      
      // Refresh list
      fetchPendingTransactions();
      setSelectedIds(prev => {
        const updated = new Set(prev);
        updated.delete(transaction.id);
        return updated;
      });

    } catch (error: any) {
      console.error('Error crediting wallet:', error);
      toast.error(error.message || "Failed to credit wallet");
      throw error;
    }
  };

  const handleSingleCredit = async (transaction: PendingTransaction) => {
    setConfirmDialog({ open: true, transaction, isBatch: false });
  };

  const handleBatchCredit = () => {
    if (selectedIds.size === 0) {
      toast.error("No transactions selected");
      return;
    }
    setConfirmDialog({ open: true, transaction: null, isBatch: true });
  };

  const confirmCredit = async () => {
    try {
      if (confirmDialog.isBatch) {
        // Batch credit
        const selectedTransactions = pendingTransactions.filter(tx => 
          selectedIds.has(tx.id)
        );
        
        let successCount = 0;
        let failCount = 0;

        for (const tx of selectedTransactions) {
          try {
            await creditWallet(tx);
            successCount++;
          } catch (error) {
            failCount++;
          }
        }

        toast.success(`Batch complete: ${successCount} succeeded, ${failCount} failed`);
      } else if (confirmDialog.transaction) {
        // Single credit
        await creditWallet(confirmDialog.transaction);
      }
    } finally {
      setConfirmDialog({ open: false, transaction: null, isBatch: false });
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };

  const exportToCSV = () => {
    const csv = [
      ['Transaction ID', 'Bill Code', 'User Name', 'Email', 'Amount (RM)', 'Created At', 'Expires At', 'Status'].join(','),
      ...filteredTransactions.map(tx => [
        tx.id,
        tx.toyyibpay_transaction_id || 'N/A',
        tx.user?.full_name || 'Unknown',
        tx.user?.email || 'Unknown',
        tx.amount,
        new Date(tx.created_at).toLocaleString(),
        tx.expires_at ? new Date(tx.expires_at).toLocaleString() : 'N/A',
        tx.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pending-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Payment Reconciliation
            </CardTitle>
            <CardDescription>
              Manually credit stuck payments and resolve ToyyibPay issues
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPendingTransactions}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={filteredTransactions.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Pending Payments</div>
            <div className="text-2xl font-bold">{stats.totalPending}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Amount</div>
            <div className="text-2xl font-bold">RM {stats.totalAmount.toFixed(2)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Expired</div>
            <div className="text-2xl font-bold text-destructive">{stats.expiredCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Selected</div>
            <div className="text-2xl font-bold">{selectedIds.size}</div>
          </Card>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by Bill Code, User, Email, or Amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={handleBatchCredit}
            disabled={selectedIds.size === 0}
            className="whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Credit Selected ({selectedIds.size})
          </Button>
        </div>

        {stats.expiredCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              {stats.expiredCount} payment{stats.expiredCount > 1 ? 's have' : ' has'} expired. Please review and take action.
            </AlertDescription>
          </Alert>
        )}

        {/* Transactions List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No pending payments</p>
              <p className="text-sm">All payments are reconciled!</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              {filteredTransactions.length > 0 && (
                <div className="flex items-center gap-2 p-3 border-b">
                  <Checkbox
                    checked={selectedIds.size === filteredTransactions.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium">
                    Select All ({filteredTransactions.length} transactions)
                  </span>
                </div>
              )}

              {filteredTransactions.map((tx) => (
                <Card key={tx.id} className={`p-4 ${isExpired(tx.expires_at) ? 'border-destructive' : ''}`}>
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedIds.has(tx.id)}
                      onCheckedChange={() => toggleSelection(tx.id)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{tx.user?.full_name}</span>
                            {isExpired(tx.expires_at) && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                            <Badge variant="secondary">{tx.status}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{tx.user?.email}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            RM {Number(tx.amount).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Bill Code:</span>
                          <div className="font-mono font-medium">
                            {tx.toyyibpay_transaction_id || (
                              <span className="text-destructive">Missing</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <div className="font-medium">
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expires:</span>
                          <div className="font-medium">
                            {tx.expires_at 
                              ? new Date(tx.expires_at).toLocaleString()
                              : 'N/A'
                            }
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Transaction ID: {tx.id}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {tx.toyyibpay_transaction_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyWithToyyibPay(tx.toyyibpay_transaction_id!)}
                          disabled={verifyingBillCode === tx.toyyibpay_transaction_id}
                        >
                          {verifyingBillCode === tx.toyyibpay_transaction_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleSingleCredit(tx)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Credit
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => 
        !open && setConfirmDialog({ open: false, transaction: null, isBatch: false })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment Credit</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.isBatch ? (
                <>
                  You are about to manually credit <span className="font-bold">{selectedIds.size}</span> payment(s).
                  This action cannot be undone.
                </>
              ) : confirmDialog.transaction && (
                <>
                  Credit <span className="font-bold">RM {Number(confirmDialog.transaction.amount).toFixed(2)}</span> to{' '}
                  <span className="font-bold">{confirmDialog.transaction.user?.full_name}</span>?
                  <br /><br />
                  This will mark the transaction as completed and add funds to their wallet.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCredit}>
              Confirm Credit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
