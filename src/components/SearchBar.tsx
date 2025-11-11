import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, MapPin, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SearchBar = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [gettingLocation, setGettingLocation] = useState(false);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
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
          setLocation(locationName);
          toast.success(`Location: ${locationName}`);
        } catch {
          toast.error('Failed to get location');
        } finally {
          setGettingLocation(false);
        }
      },
      () => {
        setGettingLocation(false);
        toast.error('Unable to get location');
      }
    );
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (dateRange?.from) params.set("start_date", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("end_date", format(dateRange.to, "yyyy-MM-dd"));
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-card rounded-[20px] shadow-lg p-2 border border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Location */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-accent/5 transition-colors">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0 relative">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Location
              </label>
              <Input
                type="text"
                placeholder="City or area"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="border-0 p-0 pr-8 h-auto focus-visible:ring-0 text-sm bg-transparent"
                aria-label="Enter location"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-6 min-h-[44px] min-w-[44px]"
                onClick={getUserLocation}
                disabled={gettingLocation}
                aria-label={gettingLocation ? "Getting your location" : "Use current location"}
              >
                {gettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Dates */}
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-accent/5 transition-colors cursor-pointer">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Dates
                  </label>
                  <p className="text-sm">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                      ) : (
                        format(dateRange.from, "MMM d")
                      )
                    ) : (
                      "Select dates"
                    )}
                  </p>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                disabled={(date) => date < new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Search Button */}
          <div className="flex items-center justify-center md:justify-end px-2">
            <Button 
              size="lg" 
              onClick={handleSearch} 
              className="w-full md:w-auto gap-2 rounded-xl min-h-[44px]"
              aria-label="Search for rental items"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
