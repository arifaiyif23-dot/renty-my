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
import { WalletInsights } from "@/components/WalletInsights";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

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
        
        // Subscribe to realtime updates for payment completion
        const billCode = data.billCode;
        const channel = supabase
          .channel(`payment-${billCode}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'wallet_transactions',
              filter: `toyyibpay_transaction_id=eq.${billCode}`
            },
            (payload) => {
              if (payload.new && (payload.new as any).status === 'completed') {
                haptics.success();
                toast.success('Payment confirmed! Wallet updated.');
                fetchWalletData();
                supabase.removeChannel(channel);
              }
            }
          )
          .subscribe();
        
        // Cleanup subscription after 10 minutes
        setTimeout(() => {
          supabase.removeChannel(channel);
          toast.info('Payment window expired. Please check your wallet or contact support if needed.');
        }, 600000); // 10 minutes
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
          {/* Wallet Insights */}
          <WalletInsights transactions={transactions} balance={wallet?.balance || 0} />

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
                <div className="space-y-2">
                  {/* Group by month */}
                  {Object.entries(
                    filteredTransactions.reduce((acc, t) => {
                      const month = format(new Date(t.created_at), 'MMMM yyyy');
                      if (!acc[month]) acc[month] = [];
                      acc[month].push(t);
                      return acc;
                    }, {} as Record<string, typeof filteredTransactions>)
                  ).map(([month, monthTransactions]) => (
                    <Collapsible key={month} defaultOpen={true}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 rounded-lg">
                        <span className="font-semibold">{month}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {monthTransactions.length} transactions
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 mt-2">
                        {monthTransactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(transaction.created_at), 'MMM d, h:mm a')}
                              </p>
                            </div>
                            <div className={`font-semibold ${
                              transaction.type === 'rental_earning' || transaction.type === 'top_up' || transaction.type === 'deposit' || transaction.type === 'refund'
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {['rental_earning', 'top_up', 'deposit', 'refund'].includes(transaction.type) ? '+' : '-'}
                              RM {transaction.amount.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
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