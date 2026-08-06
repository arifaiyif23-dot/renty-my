import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, TrendingUp, Clock, ArrowLeft } from "lucide-react";


const RECENT_SEARCHES_KEY = "renty_recent_searches";

const RECOMMENDED_CATEGORIES = [
  "electronics", "cameras", "tools", "sports",
  "gardening", "party", "books", "gaming",
];

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSearch?: (query: string) => void;
}

const MobileSearchOverlay = ({ open, onClose, onSearch }: MobileSearchOverlayProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [open]);

  const saveRecentSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const handleSubmit = (q: string) => {
    saveRecentSearch(q);
    onSearch?.(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
    onClose();
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background animate-enter flex flex-col safe-area-top">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
          aria-label="Close search"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit(query);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search items..."
            className="w-full h-12 bg-muted rounded-xl px-4 pl-10 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            aria-label="Search items"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query ? (
          <div className="p-4">
            <button
              type="button"
              onClick={() => handleSubmit(query)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors press"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Search for "<strong>{query}</strong>"
              </span>
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Recent
                  </h3>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search) => (
                    <button
                      key={search}
                      type="button"
                      onClick={() => { setQuery(search); handleSubmit(search); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-sm press"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{search}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-3 w-3" /> Browse Categories
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {RECOMMENDED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSubmit(cat)}
                    className="p-3.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-sm font-medium text-left capitalize press"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { MobileSearchOverlay };
