const path = require('path');

/**
 * bWallet opens bApps inside its main frame as a cross-origin iframe. Its origin is
 * capacitor://localhost on iOS and https://localhost on Android. Before opening, the
 * wallet fetches the page and checks these headers; a page that refuses framing (or
 * sends X-Frame-Options) falls back to the full-screen browser.
 * See bitcoin-apps-suite/bapp-standard and yours-mobile docs/BAPP-FRAME.md.
 */
const FRAME_ANCESTORS = "frame-ancestors 'self' capacitor://localhost https://localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['@handcash/handcash-connect', 'sharp'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: FRAME_ANCESTORS }],
      },
      {
        // The service worker must be re-checked on every load, never served stale.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/bapp.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias['@shared'] = path.resolve(__dirname, '../shared');
    // Ensure shared/ components resolve node_modules from website/
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];
    return config;
  },
};
module.exports = nextConfig;
