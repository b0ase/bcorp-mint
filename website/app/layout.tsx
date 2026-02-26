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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bitcoin Mint — The Currency Designer',
    description:
      'Design, print, stamp, and mint currency on BSV. Free desktop app with zero telemetry.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
