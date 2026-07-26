import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Search, MapPin, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchBarV2Props {
  className?: string;
  variant?: "hero" | "inline";
  onSearch?: (query: string) => void;
}

const MALAYSIA_STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan",
  "Melaka", "Negeri Sembilan", "Pahang", "Penang", "Perak",
  "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu",
];

const SearchBarV2 = ({ className, variant = "hero", onSearch }: SearchBarV2Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [showLocation, setShowLocation] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocation(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    if (location) params.set("location", location);
    else params.delete("location");
    navigate(`/search?${params.toString()}`);
    onSearch?.(query);
  };

  const isHero = variant === "hero";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "relative transition-all duration-300",
        isHero ? "w-full" : "w-full",
        className
      )}
    >
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-2xl bg-white border transition-all duration-300",
          focused
            ? "border-primary shadow-lg shadow-primary/5 ring-2 ring-primary/10"
            : "border-border shadow-1 hover:shadow-2",
          isHero ? "h-14 px-4" : "h-12 px-3"
        )}
      >
        <Search
          className={cn(
            "shrink-0 transition-colors duration-200",
            focused ? "text-primary" : "text-muted-foreground",
            isHero ? "h-5 w-5" : "h-4 w-4"
          )}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('search.placeholder')}
          className={cn(
            "flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground/60 font-medium",
            isHero ? "text-base" : "text-sm"
          )}
          aria-label="Search items"
        />

        <div className="flex items-center gap-2">
          <div className="relative" ref={locationRef}>
            <button
              type="button"
              onClick={() => setShowLocation(!showLocation)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
                location
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <MapPin className={cn(isHero ? "h-4 w-4" : "h-3.5 w-3.5")} />
              <span className="hidden sm:inline">
                {location || "Malaysia"}
              </span>
            </button>

            {showLocation && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-2xl shadow-3 p-2 z-50 animate-scale-in">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  {t('search.selectState')}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setLocation(""); setShowLocation(false); }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors",
                      !location ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    )}
                  >
                    All Malaysia
                  </button>
                  {MALAYSIA_STATES.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => { setLocation(state); setShowLocation(false); }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors",
                        location === state
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted"
                      )}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={t('common.clear')}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { SearchBarV2, MALAYSIA_STATES };
