import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tag, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PromoCodeRedemptionProps {
  onPromoApplied: (discount: { type: string; amount: number; code: string; id: string }) => void;
  originalPrice: number;
}

export const PromoCodeRedemption = ({ onPromoApplied, originalPrice }: PromoCodeRedemptionProps) => {
  const { user } = useAuth();
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<any>(null);

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      toast.error("Please enter a promo code");
      return;
    }

    if (!user) {
      toast.error("Please login to apply promo codes");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-promo-code', {
        body: { code: promoCode.toUpperCase(), userId: user.id },
      });

      if (error) throw error;

      if (data.valid) {
        const discount = {
          type: data.promoCode.discountType,
          amount: Number(data.promoCode.discountAmount),
          code: data.promoCode.code,
          id: data.promoCode.id,
        };

        setAppliedPromo(discount);
        onPromoApplied(discount);
        
        const discountValue = discount.type === 'percentage' 
          ? (originalPrice * discount.amount) / 100
          : discount.amount;

        toast.success(`Promo code applied! You save RM ${discountValue.toFixed(2)}`);
      }
    } catch (error: any) {
      console.error('Error validating promo code:', error);
      toast.error(error.message || 'Invalid promo code');
    } finally {
      setLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    onPromoApplied({ type: '', amount: 0, code: '', id: '' });
    toast.info("Promo code removed");
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Have a Promo Code?</h3>
      </div>

      {!appliedPromo ? (
        <div className="flex gap-2">
          <Input
            placeholder="Enter promo code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="flex-1"
            disabled={loading}
          />
          <Button
            onClick={validatePromoCode}
            disabled={loading || !promoCode.trim()}
            size="sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Apply"
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            <div>
              <p className="font-semibold text-sm">{appliedPromo.code}</p>
              <p className="text-xs text-muted-foreground">
                {appliedPromo.type === 'percentage' 
                  ? `${appliedPromo.amount}% off`
                  : `RM ${appliedPromo.amount} off`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={removePromo}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
};
