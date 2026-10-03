import type { Metadata, Viewport } from 'next';
import { Orbitron, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import RegisterServiceWorker from './sw-register';

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bitcoin Mint — Design, Sign & Seal on Bitcoin',
  description:
    'Design currency, sign documents, seal with on-chain proof, and manage your identity vault — all on BSV. E2E encrypted vault, co-signing, IP threads, and BSV-20 token minting.',
  applicationName: 'Bitcoin Mint',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'bMint',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Bitcoin Mint — Design, Sign & Seal on Bitcoin',
    description:
      'Currency designer, document signing, identity vault, and on-chain proof — all in one PWA.',
    url: 'https://bitcoin-mint.com',
    siteName: 'Bitcoin Mint',
    type: 'website',
    images: [{ url: 'https://bitcoin-mint.com/og.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bitcoin Mint — Design, Sign & Seal on Bitcoin',
    description:
      'Currency designer, document signing, identity vault, and on-chain proof — all in one PWA.',
    images: ['https://bitcoin-mint.com/og.jpg'],
  },
};

// viewport-fit=cover so the app can pad with env(safe-area-inset-*) on notched
// phones; inside bWallet's frame those insets resolve to 0 (bApp standard, 2.2).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#030303',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${ibmPlexMono.variable}`}>
      <head>
        {/* bApp manifest (bitcoin-apps-suite/bapp-standard, section 6) */}
        <link rel="bapp-manifest" href="/bapp.json" />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
