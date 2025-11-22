import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, TrendingUp, Clock, Check } from "lucide-react";
import { format } from "date-fns";

interface Earning {
  id: string;
  amount: number;
  status: string;
  payout_status: string;
  held_until: string;
  released_at: string;
  created_at: string;
  rental: {
    item: {
      title: string;
    };
  };
}

export default function Earnings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    accountNumber: "",
    accountHolderName: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchEarnings();
  }, [user, navigate]);

  const fetchEarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('owner_earnings')
        .select(`
          *,
          rental:rentals(
            item:items(
              title
            )
          )
        `)
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEarnings(data || []);

      const available = (data || [])
        .filter(e => e.status === 'released' && e.payout_status === 'pending')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      setAvailableBalance(available);
    } catch (error: any) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(payoutAmount) > availableBalance) {
      toast.error('Amount exceeds available balance');
      return;
    }

    if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountHolderName) {
      toast.error('Please fill in all bank details');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('request-payout', {
        body: {
          amount: parseFloat(payoutAmount),
          bankDetails
        }
      });

      if (error) throw error;

      toast.success('Payout request submitted successfully!');
      setPayoutDialogOpen(false);
      setPayoutAmount("");
      setBankDetails({ bankName: "", accountNumber: "", accountHolderName: "" });
      fetchEarnings();
    } catch (error: any) {
      console.error('Payout request error:', error);
      toast.error(error.message || 'Failed to submit payout request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (earning: Earning) => {
    if (earning.status === 'released' && earning.payout_status === 'pending') {
      return <Badge className="bg-primary/20 text-primary">Available</Badge>;
    }
    if (earning.payout_status === 'processing') {
      return <Badge className="bg-secondary/20 text-secondary">Payout Pending</Badge>;
    }
    if (earning.payout_status === 'paid') {
      return <Badge className="bg-accent/20 text-accent">Paid Out</Badge>;
    }
    if (earning.status === 'held') {
      return <Badge variant="secondary">On Hold</Badge>;
    }
    return <Badge variant="outline">{earning.status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">Loading earnings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Earnings</h1>
          <p className="text-muted-foreground">Track and manage your rental earnings</p>
        </div>

        {/* Available Balance Card */}
        <Card className="card-elevated mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Available for Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-primary">
                  RM {availableBalance.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  From {earnings.filter(e => e.status === 'released' && e.payout_status === 'pending').length} completed rentals
                </p>
              </div>
              <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="lg"
                    disabled={availableBalance <= 0}
                    className="gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Request Payout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Payout</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="amount">Amount (RM)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        max={availableBalance}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Available: RM {availableBalance.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        placeholder="e.g., Maybank"
                        value={bankDetails.bankName}
                        onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})}
                      />
                    </div>

                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        placeholder="e.g., 1234567890"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                      />
                    </div>

                    <div>
                      <Label htmlFor="accountHolderName">Account Holder Name</Label>
                      <Input
                        id="accountHolderName"
                        placeholder="Full name as per bank account"
                        value={bankDetails.accountHolderName}
                        onChange={(e) => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                      />
                    </div>

                    <Button
                      onClick={handlePayoutRequest}
                      disabled={submitting}
                      className="w-full"
                    >
                      {submitting ? 'Submitting...' : 'Submit Payout Request'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Earnings History */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings History</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No earnings yet</p>
                <p className="text-sm mt-2">Your rental earnings will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {earnings.map((earning) => (
                  <div
                    key={earning.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{earning.rental.item.title}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {earning.status === 'held' ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Available on {format(new Date(earning.held_until), 'MMM dd, yyyy')}
                            </span>
                          </>
                        ) : earning.status === 'released' ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Released {format(new Date(earning.released_at), 'MMM dd, yyyy')}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-lg font-bold text-primary">
                          RM {Number(earning.amount).toFixed(2)}
                        </p>
                        {getStatusBadge(earning)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
