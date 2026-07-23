import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to debounce value changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook to detect clicks outside a referenced element.
 */
export function useClickOutside(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback]);
}

/**
 * Custom hook to manage keyboard focus index.
 */
export function useKeyboardNavigation(
  resultsCount: number,
  onSelect: (index: number) => void,
  onClose: () => void
) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (resultsCount === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(prev => (prev + 1 >= resultsCount ? 0 : prev + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(prev => (prev - 1 < 0 ? resultsCount - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < resultsCount) {
        onSelect(activeIndex);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      setActiveIndex(-1);
    }
  };

  return { activeIndex, setActiveIndex, handleKeyDown };
}
