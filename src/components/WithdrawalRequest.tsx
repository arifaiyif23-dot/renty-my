import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wallet, ArrowUpRight } from "lucide-react";

interface WithdrawalRequestProps {
  availableBalance: number;
  onSuccess: () => void;
}

export const WithdrawalRequest = ({ availableBalance, onSuccess }: WithdrawalRequestProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [minWithdrawal, setMinWithdrawal] = useState(5);
  const [maxWithdrawal, setMaxWithdrawal] = useState(50000);
  const [processingFee, setProcessingFee] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Fetch withdrawal constraints when dialog opens
  const fetchConstraints = async () => {
    try {
      const { data: minData } = await supabase.rpc('get_platform_setting', { 
        setting_key: 'min_withdrawal_amount' 
      });
      const { data: maxData } = await supabase.rpc('get_platform_setting', { 
        setting_key: 'max_withdrawal_amount' 
      });
      const { data: feeData } = await supabase.rpc('get_platform_setting', { 
        setting_key: 'withdrawal_processing_fee' 
      });
      
      setMinWithdrawal(minData || 5);
      setMaxWithdrawal(maxData || 50000);
      setProcessingFee(feeData || 0);
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Error fetching withdrawal constraints:', error);
      setSettingsLoaded(true); // Still allow submission with defaults
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const withdrawAmount = Number(amount);
    const totalDeduction = withdrawAmount + processingFee;

    // Client-side validation
    if (withdrawAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    if (withdrawAmount < minWithdrawal) {
      toast.error(`Minimum withdrawal amount is RM ${minWithdrawal.toFixed(2)}`);
      return;
    }

    if (withdrawAmount > maxWithdrawal) {
      toast.error(`Maximum withdrawal amount is RM ${maxWithdrawal.toFixed(2)}`);
      return;
    }

    if (totalDeduction > availableBalance) {
      toast.error(`Insufficient balance. You need RM ${totalDeduction.toFixed(2)} (including RM ${processingFee.toFixed(2)} processing fee)`);
      return;
    }

    if (!bankName || !accountNumber || !accountHolderName) {
      toast.error("Please fill in all bank details");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id,
      amount: withdrawAmount,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder_name: accountHolderName,
    });

    setLoading(false);

    if (error) {
      console.error('Withdrawal request error:', error);
      toast.error(error.message || "Failed to submit withdrawal request");
      return;
    }

    toast.success("Withdrawal request submitted successfully. Pending admin approval.");
    setOpen(false);
    setAmount("");
    setBankName("");
    setAccountNumber("");
    setAccountHolderName("");
    onSuccess();
  };

  const withdrawAmount = Number(amount) || 0;
  const totalDeduction = withdrawAmount + processingFee;
  const newBalance = availableBalance - totalDeduction;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen && !settingsLoaded) {
        fetchConstraints();
      }
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <ArrowUpRight className="w-4 h-4" />
          Withdraw Funds
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="available">Available Balance</Label>
            <div className="text-2xl font-bold text-primary">
              RM {availableBalance.toFixed(2)}
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Withdrawal Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={minWithdrawal}
              max={maxWithdrawal}
              placeholder={`Min: RM ${minWithdrawal} • Max: RM ${maxWithdrawal}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {settingsLoaded && (
              <p className="text-xs text-muted-foreground mt-1">
                Min: RM {minWithdrawal.toFixed(2)} • Max: RM {maxWithdrawal.toFixed(2)}
              </p>
            )}
          </div>

          {/* Withdrawal Preview */}
          {withdrawAmount > 0 && (
            <Card className="p-4 space-y-2 bg-muted/50">
              <h4 className="font-semibold text-sm">Withdrawal Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Withdrawal Amount:</span>
                  <span className="font-medium">RM {withdrawAmount.toFixed(2)}</span>
                </div>
                {processingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Fee:</span>
                    <span className="font-medium">RM {processingFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">Total Deduction:</span>
                  <span className="font-semibold text-destructive">
                    RM {totalDeduction.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Balance:</span>
                  <span className={`font-semibold ${newBalance < 0 ? 'text-destructive' : 'text-primary'}`}>
                    RM {Math.max(0, newBalance).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-semibold">Bank Details</h4>

            <div>
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="e.g. Maybank, CIMB, Public Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="1234567890"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="accountHolderName">Account Holder Name</Label>
              <Input
                id="accountHolderName"
                placeholder="As per bank account"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="text-muted-foreground">
              Processing time: 1-3 business days. You'll receive a notification once processed.
            </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Withdrawals require admin approval</p>
            <p>• Processing time: 1-3 business days after approval</p>
            {processingFee > 0 && <p>• Processing fee: RM {processingFee.toFixed(2)}</p>}
          </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
