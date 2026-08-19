import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      setQuery("");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusables = containerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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
<div ref={containerRef} className="fixed inset-0 z-[60] bg-background flex flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="flex items-center gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-border">
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
            placeholder={t('common.searchItemsPlaceholder')}
            className="w-full h-12 bg-muted rounded-xl px-4 pl-10 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            aria-label="Search items"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
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
                    aria-label="Clear recent searches"
                    className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] flex items-center px-2"
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
