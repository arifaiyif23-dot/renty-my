import { useEffect, useState } from "react";
import { useWalletRealtime } from "@/hooks/use-wallet-realtime";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletType, WalletTransaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpCircle, ArrowDownCircle, Wallet as WalletIcon, Plus, Filter, Download, ArrowDownToLine } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Header from "@/components/Header";
import { PaymentErrorBoundary } from "@/components/PaymentErrorBoundary";
import { WithdrawalRequest } from "@/components/WithdrawalRequest";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { WalletSkeleton } from "@/components/WalletSkeleton";
import { haptics } from "@/utils/haptics";

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Use realtime wallet updates
  const { balance: realtimeBalance, connectionState } = useWalletRealtime();

  const fetchWalletData = async () => {
    try {
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (walletError) throw walletError;
      setWallet(walletData);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", walletData.id)
        .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error("Error fetching wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh(fetchWalletData);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  // Update wallet balance from realtime when it changes
  useEffect(() => {
    if (realtimeBalance !== null && wallet) {
      setWallet({ ...wallet, balance: realtimeBalance });
    }
  }, [realtimeBalance]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, filterType, searchTerm]);

  const filterTransactions = () => {
    let filtered = [...transactions];

    if (filterType !== "all") {
      filtered = filtered.filter(t => t.type === filterType);
    }

    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  };

  const exportTransactions = () => {
    const csv = [
      ['Date', 'Type', 'Description', 'Amount'].join(','),
      ...filteredTransactions.map(t => [
        format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
        t.type,
        `"${t.description}"`,
        t.amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  };

  const getTransactionIcon = (type: string) => {
    if (type === 'deposit' || type === 'rental_earning' || type === 'refund' || type === 'top_up') {
      return <ArrowDownCircle className="h-5 w-5 text-success" />;
    }
    return <ArrowUpCircle className="h-5 w-5 text-destructive" />;
  };

  const getTransactionAmount = (type: string, amount: number) => {
    if (type === 'deposit' || type === 'rental_earning' || type === 'refund' || type === 'top_up') {
      return `+RM ${amount.toFixed(2)}`;
    }
    return `-RM ${amount.toFixed(2)}`;
  };

  const handleTopUp = async () => {
    if (!user || !topUpAmount) {
      toast.error('Please enter an amount');
      haptics.error();
      return;
    }

    const amount = parseFloat(topUpAmount);
    if (amount < 10) {
      toast.error('Minimum top up amount is RM 10');
      haptics.error();
      return;
    }

    if (amount > 10000) {
      toast.error('Maximum top up amount is RM 10,000');
      haptics.error();
      return;
    }

    haptics.medium();
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-toyyibpay-bill', {
        body: {
          amount,
          description: `Wallet Top Up - RM ${amount}`,
        },
      });

      if (error) {
        console.error('Payment gateway error:', error);
        throw new Error(error.message || 'Payment gateway error');
      }

      if (!data?.paymentUrl) {
        throw new Error('Invalid payment response. Please try again.');
      }

      if (data.paymentUrl) {
        haptics.success();
        toast.success('Redirecting to payment...');
        window.open(data.paymentUrl, '_blank');
        setDialogOpen(false);
        setTopUpAmount("");
        
        // Poll for payment completion
        const billCode = data.billCode;
        let pollCount = 0;
        const maxPolls = 60;
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            toast.info('Taking longer than expected. Please check your wallet in a few minutes.');
            return;
          }
          
          try {
            const { data: statusData } = await supabase.functions.invoke('check-payment-status', {
              body: { billCode }
            });
            
            if (statusData?.status === 'completed') {
              clearInterval(pollInterval);
              haptics.success();
              toast.success('Payment confirmed! Wallet updated.');
              fetchWalletData();
            }
          } catch (error) {
            console.error('Polling error:', error);
          }
        }, 5000);
      }
    } catch (error: any) {
      console.error('Top up error:', error);
      haptics.error();
      toast.error(
        error.message || 'Failed to create payment. Please try again or contact support.',
        {
          duration: 5000,
          action: {
            label: 'Contact Support',
            onClick: () => window.location.href = '/profile'
          }
        }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <WalletSkeleton />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        {/* Pull to refresh indicator */}
        {pullDistance > 0 && (
          <div 
            className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 transition-opacity"
            style={{ opacity: Math.min(pullDistance / 80, 1) }}
          >
            <div className="glass-card p-2 rounded-full">
              <ArrowDownToLine className="h-5 w-5 text-primary animate-bounce" />
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl md:text-3xl font-bold">My Wallet</h1>
              <div className="flex gap-2">
                <WithdrawalRequest 
                  availableBalance={wallet?.balance || 0} 
                  onSuccess={fetchWalletData} 
                />
                <PaymentErrorBoundary fallbackMessage="Unable to process top-up.">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="gradient">
                        <Plus className="h-4 w-4 mr-2" />
                        Top Up
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Top Up Wallet</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Amount (RM)</Label>
                          <Input
                            id="amount"
                            type="number"
                            min="10"
                            max="10000"
                            step="0.01"
                            placeholder="Enter amount (min RM 10)"
                            value={topUpAmount}
                            onChange={(e) => setTopUpAmount(e.target.value)}
                          />
                          <p className="text-sm text-muted-foreground">
                            Minimum: RM 10.00 • Maximum: RM 10,000.00
                          </p>
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={handleTopUp}
                          disabled={isProcessing || !topUpAmount}
                        >
                          {isProcessing ? 'Processing...' : 'Continue to Payment'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </PaymentErrorBoundary>
              </div>
            </div>

            {/* Balance Card */}
            <Card className="glass-balance-card border-0 card-3d-hover overflow-hidden">
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <WalletIcon className="h-5 w-5 text-white/90 float-animation" />
                      <p className="text-sm text-white/80 font-medium">Available Balance</p>
                    </div>
                    <p className="text-4xl font-bold text-white balance-shimmer">
                      RM {wallet?.balance.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transaction History</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportTransactions}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3 mt-4">
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:w-[300px]"
                />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="md:w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="deposit">Deposits</SelectItem>
                    <SelectItem value="rental_earning">Earnings</SelectItem>
                    <SelectItem value="rental_payment">Payments</SelectItem>
                    <SelectItem value="withdrawal">Withdrawals</SelectItem>
                    <SelectItem value="refund">Refunds</SelectItem>
                    <SelectItem value="top_up">Top Ups</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((transaction, index) => (
                    <div
                      key={transaction.id}
                      className="stagger-item flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-all card-3d-hover"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <p className={`font-semibold ${
                        transaction.type === 'deposit' || transaction.type === 'rental_earning' || transaction.type === 'refund' || transaction.type === 'top_up'
                          ? 'text-success'
                          : 'text-destructive'
                      }`}>
                        {getTransactionAmount(transaction.type, transaction.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}