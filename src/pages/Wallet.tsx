import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletType, WalletTransaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUpCircle, ArrowDownCircle, Wallet as WalletIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Header from "@/components/Header";

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

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
      return;
    }

    const amount = parseFloat(topUpAmount);
    if (amount < 10) {
      toast.error('Minimum top up amount is RM 10');
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-toyyibpay-bill', {
        body: {
          amount,
          description: `Wallet Top Up - RM ${amount}`,
          userId: user.id,
        },
      });

      if (error) throw error;

      if (data.paymentUrl) {
        toast.success('Redirecting to payment...');
        window.open(data.paymentUrl, '_blank');
        setDialogOpen(false);
        setTopUpAmount("");
        
        // Refresh wallet data after a short delay
        setTimeout(() => {
          fetchWalletData();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Top up error:', error);
      toast.error(error.message || 'Failed to create payment. Please configure ToyyibPay settings.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4">
          <div className="text-center py-8">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-4xl pb-mobile-nav">
        <h1 className="text-3xl font-bold mb-6">My Wallet</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">
              RM {wallet?.balance.toFixed(2) || "0.00"}
            </p>
            <div className="flex gap-3 mt-4">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Top Up via ToyyibPay
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
                        step="0.01"
                        placeholder="Enter amount (min RM 10)"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Minimum top up: RM 10.00
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
              
              <Button size="sm" variant="outline" disabled>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Withdraw (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors"
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
    </>
  );
}