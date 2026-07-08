import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, MapPin, Calendar, Package, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeliverySchedulerProps {
  itemLocation: string;
  onDeliverySelect: (delivery: DeliveryDetails) => void;
}

export interface DeliveryDetails {
  method: 'self_pickup' | 'delivery';
  provider?: 'lalamove' | 'grab_express' | 'manual';
  fee: number;
  pickupAddress?: string;
  pickupTime?: string;
  returnTime?: string;
  instructions?: string;
}

const DELIVERY_PROVIDERS = [
  { value: 'lalamove', label: 'Lalamove', baseFee: 15 },
  { value: 'grab_express', label: 'GrabExpress', baseFee: 12 },
  { value: 'manual', label: 'Owner Delivery', baseFee: 10 },
];

export const DeliveryScheduler = ({ itemLocation, onDeliverySelect }: DeliverySchedulerProps) => {
  const [deliveryMethod, setDeliveryMethod] = useState<'self_pickup' | 'delivery'>('self_pickup');
  const [provider, setProvider] = useState('lalamove');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [instructions, setInstructions] = useState('');

  const selectedProvider = DELIVERY_PROVIDERS.find(p => p.value === provider);
  const deliveryFee = deliveryMethod === 'delivery' ? selectedProvider?.baseFee || 15 : 0;

  const getDeliveryDetails = (overrides?: { method?: 'self_pickup' | 'delivery'; provider?: string }) => {
    const effMethod = overrides?.method ?? deliveryMethod;
    const effProvider = overrides?.provider ?? provider;
    const effFee = effMethod === 'delivery'
      ? (DELIVERY_PROVIDERS.find(p => p.value === effProvider)?.baseFee || 15)
      : 0;

    const details: DeliveryDetails = {
      method: effMethod,
      fee: effFee,
    };

    if (effMethod === 'delivery') {
      details.provider = effProvider as any;
      details.pickupAddress = pickupAddress;
      details.pickupTime = pickupTime;
      details.returnTime = returnTime;
      details.instructions = instructions;
    }

    return details;
  };

  const handleMethodChange = (method: 'self_pickup' | 'delivery') => {
    setDeliveryMethod(method);
    onDeliverySelect(getDeliveryDetails({ method }));
  };

  const updateDeliveryDetails = (overrides?: { method?: 'self_pickup' | 'delivery'; provider?: string }) => {
    onDeliverySelect(getDeliveryDetails(overrides));
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Delivery & Pickup</h3>
      </div>

      {/* Delivery Method Selection */}
      <RadioGroup value={deliveryMethod} onValueChange={(v) => handleMethodChange(v as any)}>
        <div className="space-y-3">
          {/* Self Pickup */}
          <div
            className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
              deliveryMethod === 'self_pickup' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => handleMethodChange('self_pickup')}
          >
            <RadioGroupItem value="self_pickup" id="self_pickup" />
            <div className="flex-1">
              <Label htmlFor="self_pickup" className="cursor-pointer font-semibold">
                Self Pickup (Free)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{itemLocation}</p>
              </div>
              <Badge variant="secondary" className="mt-2">No delivery fee</Badge>
            </div>
          </div>

          {/* Delivery */}
          <div
            className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
              deliveryMethod === 'delivery' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => handleMethodChange('delivery')}
          >
            <RadioGroupItem value="delivery" id="delivery" />
            <div className="flex-1">
              <Label htmlFor="delivery" className="cursor-pointer font-semibold">
                Delivery Service
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Get the item delivered to your location
              </p>
              <Badge variant="default" className="mt-2">From RM {deliveryFee}</Badge>
            </div>
          </div>
        </div>
      </RadioGroup>

      {/* Delivery Options */}
      {deliveryMethod === 'delivery' && (
        <div className="space-y-4 pt-4 border-t">
          {/* Delivery Provider */}
          <div className="space-y-2">
            <Label>Delivery Provider</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v); updateDeliveryDetails({ provider: v }); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{p.label}</span>
                      <span className="text-sm text-muted-foreground ml-4">RM {p.baseFee}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pickup Address */}
          <div className="space-y-2">
            <Label htmlFor="pickup_address">Delivery Address</Label>
            <Input
              id="pickup_address"
              placeholder="Enter your delivery address"
              value={pickupAddress}
              onChange={(e) => { setPickupAddress(e.target.value); updateDeliveryDetails(); }}
            />
          </div>

          {/* Pickup & Return Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_time">Pickup Time</Label>
              <Input
                id="pickup_time"
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => { setPickupTime(e.target.value); updateDeliveryDetails(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return_time">Return Time</Label>
              <Input
                id="return_time"
                type="datetime-local"
                value={returnTime}
                onChange={(e) => { setReturnTime(e.target.value); updateDeliveryDetails(); }}
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Delivery Instructions (Optional)</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., Call when arrived, Leave at security, etc."
              value={instructions}
              onChange={(e) => { setInstructions(e.target.value); updateDeliveryDetails(); }}
              rows={3}
            />
          </div>

          {/* Info Note */}
          <div className="flex gap-2 p-3 bg-muted rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Delivery fee may vary based on distance. Final fee will be confirmed before payment.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
