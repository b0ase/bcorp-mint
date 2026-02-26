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
  title: 'Bitcoin Mint — The Currency Designer',
  description:
    'Design, print, stamp, and mint currency on BSV. A desktop application for creating cryptographic currency with 11 security layers, SHA-256 stamping, and BSV-20 token minting.',
  openGraph: {
    title: 'Bitcoin Mint — The Currency Designer',
    description:
      'Design, print, stamp, and mint currency on BSV. Free desktop app with zero telemetry.',
    url: 'https://bitcoin-mint.com',
    siteName: 'Bitcoin Mint',
    type: 'website',
    images: [{ url: 'https://bitcoin-mint.com/og.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bitcoin Mint — The Currency Designer',
    description:
      'Design, print, stamp, and mint currency on BSV. Free desktop app with zero telemetry.',
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
