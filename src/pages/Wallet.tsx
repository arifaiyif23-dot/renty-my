import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletType, WalletTransaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, ArrowDownCircle, Wallet as WalletIcon } from "lucide-react";
import { format } from "date-fns";
import Header from "@/components/Header";

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (type === 'deposit' || type === 'rental_earning' || type === 'refund') {
      return <ArrowDownCircle className="h-5 w-5 text-success" />;
    }
    return <ArrowUpCircle className="h-5 w-5 text-destructive" />;
  };

  const getTransactionAmount = (type: string, amount: number) => {
    if (type === 'deposit' || type === 'rental_earning' || type === 'refund') {
      return `+RM ${amount.toFixed(2)}`;
    }
    return `-RM ${amount.toFixed(2)}`;
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
      <div className="container mx-auto p-4 max-w-4xl">
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
              <Button size="sm" variant="outline" disabled>
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                Top Up (Coming Soon)
              </Button>
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
                      transaction.type === 'deposit' || transaction.type === 'rental_earning' || transaction.type === 'refund'
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
