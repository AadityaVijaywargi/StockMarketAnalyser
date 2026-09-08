import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { SearchService, SearchStock } from './SearchService';
import { SearchDropdown } from './SearchDropdown';
import { useDebounce, useClickOutside, useKeyboardNavigation } from './SearchHooks';

interface SearchBarProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading = false,
  placeholder = "Search ticker, company or index (e.g. TCS, Tata Motors, Nifty)...",
  className = "",
  compact = false
}) => {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [results, setResults] = useState<SearchStock[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce<string>(query, 180);

  const popularStocks: SearchStock[] = SearchService.getPopularStocks();

  // 1. Load recent searches on focus/mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('recent_searches');
      if (cached) {
        setRecentSearches(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to load recent searches", e);
    }
  }, [isOpen]);

  // 2. Perform debounced fuzzy search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const matched = SearchService.search(debouncedQuery);
    setResults(matched);
    setIsSearching(false);
  }, [debouncedQuery]);

  // 3. Clear recent searches
  const handleClearRecent = () => {
    localStorage.removeItem('recent_searches');
    setRecentSearches([]);
  };

  // 4. Click outside dropdown wrapper trigger close
  useClickOutside(containerRef, () => {
    setIsOpen(false);
  });

  // 5. Select symbol click handler
  const handleSelectStock = (stock: SearchStock) => {
    onSearch(stock.ticker);
    setIsOpen(false);
    setQuery('');
  };

  // 6. Keyboard navigation hooks
  const { activeIndex, setActiveIndex, handleKeyDown: hookKeyDown } = useKeyboardNavigation(
    results.length,
    (index) => handleSelectStock(results[index]),
    () => setIsOpen(false)
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // 1. If user navigated to an item using keyboard arrow keys
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelectStock(results[activeIndex]);
        return;
      }
      
      const cleanQ = query.trim();
      if (!cleanQ) return;

      const matched = SearchService.search(cleanQ);

      // 2. Only navigate if there is a high-confidence match (matchScore >= 750 and not fuzzy-only)
      if (matched.length > 0 && !matched[0].isFuzzySuggestion && (matched[0].matchScore || 0) >= 750) {
        handleSelectStock(matched[0]);
      } else {
        // INVALID SEARCH / ZERO MATCHES / WEAK MATCH:
        // DO NOT NAVIGATE!
        // DO NOT TRIGGER ANALYSIS!
        // DO NOT CHANGE CURRENTLY SELECTED STOCK!
        // Keep dropdown open displaying suggestions or "Did you mean..."
        setIsOpen(true);
      }
    } else {
      hookKeyDown(e);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-xl font-sans ${className}`}>
      
      {/* Visual Search Box Input Area */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-surface border border-borderDark/80 hover:border-borderDark focus:border-brand focus:ring-1 focus:ring-brand rounded-xl text-white placeholder-textMuted transition-all font-sans shadow-premium focus:outline-none ${
            compact ? 'py-2 pl-10 pr-10 text-xs' : 'py-3.5 pl-12 pr-12 text-sm'
          }`}
        />

        {/* Left Search Icon */}
        <div className={`absolute text-textMuted ${compact ? 'left-3' : 'left-4'}`}>
          <Search className={compact ? 'w-4 h-4 text-brand' : 'w-5 h-5 text-brand'} />
        </div>

        {/* Right Loading Spinner */}
        {(isLoading || isSearching) && (
          <div className={`absolute text-brand ${compact ? 'right-3' : 'right-4'}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        )}
      </div>

      {/* Auto-suggest dropdown overlay list */}
      {isOpen && (
        <SearchDropdown
          query={query}
          results={results}
          recentSearches={recentSearches}
          popularStocks={popularStocks}
          activeIndex={activeIndex}
          onSelectStock={handleSelectStock}
          setActiveIndex={setActiveIndex}
          onClearRecent={handleClearRecent}
        />
      )}
    </div>
  );
};
