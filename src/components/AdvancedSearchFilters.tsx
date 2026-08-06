import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Zap, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground">{t('filters.quickFilters')}</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <Label htmlFor="verified-only" className="cursor-pointer">
              {t('filters.verifiedOwnersOnly')}
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
              {t('filters.instantBookAvailable')}
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
        <Label htmlFor="item-condition">{t('filters.itemCondition')}</Label>
        <Select value={itemCondition} onValueChange={setItemCondition}>
          <SelectTrigger id="item-condition">
            <SelectValue placeholder={t('filters.anyCondition')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.anyCondition')}</SelectItem>
            <SelectItem value="new">{t('filters.conditionNew')}</SelectItem>
            <SelectItem value="like_new">{t('filters.conditionLikeNew')}</SelectItem>
            <SelectItem value="good">{t('filters.conditionGood')}</SelectItem>
            <SelectItem value="fair">{t('filters.conditionFair')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showDistanceFilter && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <Label>{t('filters.maximumDistance')}</Label>
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