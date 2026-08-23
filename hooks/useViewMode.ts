'use client';

import { useState, useEffect } from 'react';
import { useIsMobile } from './use-mobile';

export type ViewMode = 'cards' | 'table';

export function useViewMode(storageKey?: string) {
  const isMobile = useIsMobile();
  const [userSelection, setUserSelection] = useState<ViewMode | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`orah_view_mode_${storageKey}`);
        if (saved === 'cards' || saved === 'table') {
          setUserSelection(saved);
        }
      } catch {
        // Ignore localStorage error
      }
    }
  }, [storageKey]);

  // Determine current active view mode:
  // If user explicitly picked a mode, use that.
  // Otherwise, default to 'cards' on mobile and 'table' on desktop.
  const effectiveMode: ViewMode = userSelection !== null 
    ? userSelection 
    : (hasMounted && isMobile ? 'cards' : 'table');

  const setViewMode = (mode: ViewMode) => {
    setUserSelection(mode);
    if (storageKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`orah_view_mode_${storageKey}`, mode);
      } catch {
        // Ignore localStorage error
      }
    }
  };

  return [effectiveMode, setViewMode] as const;
}
