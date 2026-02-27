import type { Metadata } from 'next';
import { Orbitron, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${ibmPlexMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
