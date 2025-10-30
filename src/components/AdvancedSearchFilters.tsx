import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Zap, MapPin } from 'lucide-react';

interface AdvancedSearchFiltersProps {
  verifiedOnly: boolean;
  setVerifiedOnly: (value: boolean) => void;
  instantBookOnly: boolean;
  setInstantBookOnly: (value: boolean) => void;
  itemCondition: string;
  setItemCondition: (value: string) => void;
  maxDistance: number;
  setMaxDistance: (value: number) => void;
  showDistanceFilter: boolean;
}

export function AdvancedSearchFilters({
  verifiedOnly,
  setVerifiedOnly,
  instantBookOnly,
  setInstantBookOnly,
  itemCondition,
  setItemCondition,
  maxDistance,
  setMaxDistance,
  showDistanceFilter,
}: AdvancedSearchFiltersProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground">Quick Filters</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <Label htmlFor="verified-only" className="cursor-pointer">
              Verified Owners Only
            </Label>
          </div>
          <Switch
            id="verified-only"
            checked={verifiedOnly}
            onCheckedChange={setVerifiedOnly}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <Label htmlFor="instant-book" className="cursor-pointer">
              Instant Book Available
            </Label>
          </div>
          <Switch
            id="instant-book"
            checked={instantBookOnly}
            onCheckedChange={setInstantBookOnly}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="item-condition">Item Condition</Label>
        <Select value={itemCondition} onValueChange={setItemCondition}>
          <SelectTrigger id="item-condition">
            <SelectValue placeholder="Any condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Condition</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="like_new">Like New</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showDistanceFilter && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <Label>Maximum Distance</Label>
            </div>
            <span className="text-sm text-muted-foreground">
              {maxDistance === 100 ? '100+ km' : `${maxDistance} km`}
            </span>
          </div>
          <Slider
            value={[maxDistance]}
            onValueChange={(values) => setMaxDistance(values[0])}
            min={5}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}