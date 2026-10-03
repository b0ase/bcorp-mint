'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker (public/sw.js) once the page has loaded.
 * Production only: in `next dev` a stale cache hides edits. The worker caches
 * the app shell for offline/installed use; it never touches /api/ and sends
 * nothing anywhere (the Mint's privacy rule).
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        console.warn('[pwa] service worker registration failed:', err);
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
