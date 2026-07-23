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
  placeholder = "Search ticker or company name (e.g. TCS)...",
  className = "",
  compact = false
}) => {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [results, setResults] = useState<SearchStock[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce<string>(query, 250);

  // Popular stocks database defaults
  const popularStocks: SearchStock[] = [
    { ticker: "RELIANCE.NS", name: "Reliance Industries Limited", exchange: "NSE" },
    { ticker: "TCS.NS", name: "Tata Consultancy Services Limited", exchange: "NSE" },
    { ticker: "INFY.NS", name: "Infosys Limited", exchange: "NSE" },
    { ticker: "HDFCBANK.NS", name: "HDFC Bank Limited", exchange: "NSE" },
    { ticker: "ICICIBANK.NS", name: "ICICI Bank Limited", exchange: "NSE" },
    { ticker: "SBIN.NS", name: "State Bank of India", exchange: "NSE" },
    { ticker: "BHARTIARTL.NS", name: "Bharti Airtel Limited", exchange: "NSE" },
    { ticker: "LT.NS", name: "Larsen & Toubro Limited", exchange: "NSE" }
  ];

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

  // 2. Perform debounced search
  useEffect(() => {
    if (!debouncedQuery) {
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
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelectStock(results[activeIndex]);
      } else if (query.trim()) {
        onSearch(query.trim());
        setIsOpen(false);
        setQuery('');
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
          <Search className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
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
