import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Search, MapPin, X, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay";

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

const CATEGORY_OPTIONS = ["electronics", "vehicles", "tools", "sports", "party", "fashion", "other"];

const SearchBarV2 = ({ className, variant = "hero", onSearch }: SearchBarV2Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [showLocation, setShowLocation] = useState(false);
  const [focused, setFocused] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
    if (isMobile) {
      setOverlayOpen(true);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    if (location) params.set("location", location);
    else params.delete("location");
    if (category && category !== "all") params.set("category", category);
    else params.delete("category");
    navigate(`/search?${params.toString()}`);
    onSearch?.(query);
  };

  const handleOverlaySearch = (q: string) => {
    setQuery(q);
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    if (location) params.set("location", location);
    else params.delete("location");
    if (category && category !== "all") params.set("category", category);
    else params.delete("category");
    navigate(`/search?${params.toString()}`);
    onSearch?.(q);
  };

  const isHero = variant === "hero";

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={cn("relative", className)}
      >
        <div
          className={cn(
            "relative flex items-center gap-2 transition-all duration-200",
            isHero
              ? "rounded-full border border-border/60 bg-background h-12 px-4"
              : "bg-card border border-border h-12 px-3 shadow-1",
            focused && isHero
              ? "border-primary/40 shadow-2"
              : "",
            focused && !isHero
              ? "border-primary shadow-3 shadow-primary/5 ring-2 ring-primary/10"
              : ""
          )}
        >
          <Search
            className={cn(
              "shrink-0 transition-colors duration-200",
              focused ? "text-primary" : "text-muted-foreground",
              isHero ? "h-4 w-4" : "h-4 w-4"
            )}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (isMobile) { inputRef.current?.blur(); setOverlayOpen(true); return; }
              setFocused(true);
            }}
            onBlur={() => setFocused(false)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground/60 font-medium text-sm"
            aria-label="Search items"
          />

          <div className="flex items-center gap-1.5">
            {isHero && (
              <div className="relative hidden sm:block shrink-0">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Category"
                  className={cn(
                    "appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-full text-xs font-medium transition-all duration-200 outline-none border",
                    category !== "all"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  <option value="all">{t('search.allCategories')}</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
            )}

            <div className="relative" ref={locationRef}>
              <button
                type="button"
                onClick={() => setShowLocation(!showLocation)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border",
                  location
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {location || "Malaysia"}
                </span>
              </button>

              {showLocation && (
                <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-3 p-2 z-50">
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
                className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label={t('common.clear')}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </form>

      <MobileSearchOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        onSearch={handleOverlaySearch}
      />
    </>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { SearchBarV2, MALAYSIA_STATES };
