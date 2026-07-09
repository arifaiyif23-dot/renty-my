import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, TicketPercent, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface PromoCodeResult {
  valid: boolean;
  promoId?: string;
  discountType?: 'percentage' | 'fixed';
  discountAmount?: number;
  calculatedDiscount?: number;
  code?: string;
  error?: string;
}

interface PromoCodeInputProps {
  rentalAmount: number;
  onApplied: (result: PromoCodeResult) => void;
  onRemoved: () => void;
  disabled?: boolean;
}

export function PromoCodeInput({ rentalAmount, onApplied, onRemoved, disabled }: PromoCodeInputProps) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [applied, setApplied] = useState<PromoCodeResult | null>(null);

  const handleValidate = async () => {
    if (!code.trim() || !user) return;
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-promo-enhanced", {
        body: { code: code.trim().toUpperCase(), rentalAmount },
      });

      if (error) throw new Error(error.message);

      if (data?.valid) {
        setApplied(data);
        onApplied(data);
        toast.success(`Promo applied! ${data.discountType === 'percentage' ? `${data.discountAmount}% off` : `RM ${data.calculatedDiscount} off`}`);
      } else {
        toast.error(data?.error || "Invalid promo code");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to validate code");
    } finally {
      setValidating(false);
    }
  };

  const handleRemove = () => {
    setApplied(null);
    setCode("");
    onRemoved();
  };

  if (applied) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 dark:text-green-300 flex-1">
          {applied.code} — {applied.discountType === 'percentage' ? `${applied.discountAmount}% off` : `RM ${applied.calculatedDiscount} off`}
        </span>
        <Button variant="ghost" size="sm" onClick={handleRemove} className="h-6 w-6 p-0">
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <TicketPercent className="h-4 w-4 text-muted-foreground" />
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Promo code"
        className="flex-1 h-9 text-sm uppercase"
        disabled={disabled || validating}
        onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleValidate}
        disabled={!code.trim() || validating || disabled}
        className="h-9"
      >
        {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
      </Button>
    </div>
  );
}
