import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Calendar } from "lucide-react";

const SearchBar = () => {
  const [location, setLocation] = useState("");
  const [dates, setDates] = useState("");

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-card rounded-[20px] shadow-lg p-2 border border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Location */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-accent/5 transition-colors">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Location
              </label>
              <Input
                type="text"
                placeholder="Where?"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="border-0 p-0 h-auto focus-visible:ring-0 text-sm bg-transparent"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-accent/5 transition-colors">
            <Calendar className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Dates
              </label>
              <Input
                type="text"
                placeholder="When?"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                className="border-0 p-0 h-auto focus-visible:ring-0 text-sm bg-transparent"
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="flex items-center justify-center md:justify-end px-2">
            <Button size="lg" className="w-full md:w-auto gap-2 rounded-xl">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
