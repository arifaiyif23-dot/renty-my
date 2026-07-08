import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';

interface AutocompleteSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
}

export function AutocompleteSearch({ value, onChange, onSelect }: AutocompleteSearchProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (debouncedValue.length > 1) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
    }
  }, [debouncedValue]);

  const fetchSuggestions = async (query: string) => {
    try {
      const { data } = await supabase
        .from('items')
        .select('title')
        .ilike('title', `%${query}%`)
        .limit(5);

      const uniqueTitles = [...new Set(data?.map(item => item.title) || [])];
      setSuggestions(uniqueTitles);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    onSelect?.(selectedValue);
    
    // Save to recent searches
    const updated = [selectedValue, ...recentSearches.filter(s => s !== selectedValue)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
    
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-activedescendant={undefined}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search items..."
            className="w-full h-12 pl-10 pr-4 rounded-lg border bg-background"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent id="search-suggestions" className="w-[var(--radix-popover-trigger-width)] p-0" align="start" role="listbox">
        <Command>
          <CommandList>
            {recentSearches.length > 0 && !value && (
              <CommandGroup heading="Recent Searches">
                {recentSearches.map((search, idx) => (
                  <CommandItem
                    key={idx}
                    onSelect={() => handleSelect(search)}
                    className="flex items-center gap-2"
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                    {search}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {suggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggestions.map((suggestion, idx) => (
                  <CommandItem
                    key={idx}
                    onSelect={() => handleSelect(suggestion)}
                    className="flex items-center gap-2"
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {value && suggestions.length === 0 && (
              <CommandEmpty>No results found</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
