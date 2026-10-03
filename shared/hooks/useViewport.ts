'use client';

import { useEffect, useState } from 'react';

/** Phone-width breakpoint. Below this the Mint switches to the single-column mobile layout. */
export const MOBILE_MAX_WIDTH = 767;

const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

/** True on first render only when the browser already reports a phone width (no SSR flash on client-only trees). */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Tracks whether the viewport is phone-width. Starts false during SSR and
 * resolves on mount, then follows orientation changes and resizes.
 */
export function useViewport(): { isMobile: boolean } {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    // Older WebViews
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return { isMobile };
}
