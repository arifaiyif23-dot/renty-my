import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Filter, X, MapPin, Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";
import { ItemCategory } from "@/types";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface MobileFilterDrawerProps {
  category: ItemCategory | 'all';
  setCategory: (value: ItemCategory | 'all') => void;
  minPrice: string;
  setMinPrice: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (value: DateRange | undefined) => void;
  userLocation: string;
  setUserLocation: (value: string) => void;
  activeFiltersCount: number;
}

const MobileFilterDrawer = ({
  category,
  setCategory,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  dateRange,
  setDateRange,
  userLocation,
  setUserLocation,
  activeFiltersCount,
}: MobileFilterDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          const locationName = data.address.city || data.address.town || data.address.village || 'Your location';
          setUserLocation(locationName);
          toast.success(`Location set to ${locationName}`);
        } catch (error) {
          toast.error('Failed to get location name');
        } finally {
          setGettingLocation(false);
        }
      },
      () => {
        setGettingLocation(false);
        toast.error('Unable to get your location');
      }
    );
  };

  const resetFilters = () => {
    setCategory('all');
    setMinPrice('');
    setMaxPrice('');
    setDateRange(undefined);
    setUserLocation('');
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <Filter className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <DrawerTitle>Filters</DrawerTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-destructive"
            >
              Reset All
            </Button>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Category Filter */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent rounded-lg">
              <Label className="text-base font-semibold cursor-pointer">Category</Label>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Select value={category} onValueChange={(value) => setCategory(value as ItemCategory | 'all')}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                  <SelectItem value="tools">Tools</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          {/* Location Filter */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent rounded-lg">
              <Label className="text-base font-semibold cursor-pointer">Location</Label>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="relative">
                <Input
                  placeholder="Enter location"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  className="h-12 pr-12"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-12"
                  onClick={getUserLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Date Range Filter */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent rounded-lg">
              <Label className="text-base font-semibold cursor-pointer">Date Range</Label>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Price Range Filter */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent rounded-lg">
              <Label className="text-base font-semibold cursor-pointer">Price Range (RM)</Label>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div>
                <Label htmlFor="min-price" className="text-sm mb-2 block">Minimum</Label>
                <Input
                  id="min-price"
                  type="number"
                  placeholder="Min RM"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-12"
                />
              </div>
              <div>
                <Label htmlFor="max-price" className="text-sm mb-2 block">Maximum</Label>
                <Input
                  id="max-price"
                  type="number"
                  placeholder="Max RM"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-12"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Apply Button */}
        <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
          <Button 
            className="w-full h-12 text-base font-medium" 
            onClick={() => setOpen(false)}
          >
            Apply Filters
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileFilterDrawer;
