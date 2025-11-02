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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const withdrawAmount = Number(amount);

    if (withdrawAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast.error("Insufficient balance");
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
      toast.error("Failed to submit withdrawal request");
      return;
    }

    toast.success("Withdrawal request submitted successfully");
    setOpen(false);
    setAmount("");
    setBankName("");
    setAccountNumber("");
    setAccountHolderName("");
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <ArrowUpRight className="w-4 h-4" />
          Withdraw Funds
        </Button>
      </DialogTrigger>
      <DialogContent>
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
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

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
          </div>

          <div className="flex gap-2">
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
