'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import './mint.css';

const MODES = [
  { href: '/mint/stamp', label: 'Stamp' },
  { href: '/mint/design', label: 'Design' },
] as const;

export default function MintLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mint-app">
      <header className="mint-topbar">
        <Link href="/" className="mint-brand">
          <div className="mint-brand-icon">
            <Image src="/mint/bcorp-mint-icon.png" alt="Mint" width={28} height={28} />
          </div>
          <div className="mint-brand-text">
            <span className="mint-brand-corp">The Bitcoin Corporation</span>
            <span className="mint-brand-name">Mint</span>
          </div>
        </Link>

        <nav className="mint-mode-toggle">
          {MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className={`mint-mode-btn ${pathname?.startsWith(mode.href) ? 'active' : ''}`}
            >
              {mode.label}
            </Link>
          ))}
        </nav>

        <div className="mint-topbar-right">
          <Link
            href="/mint/wallet"
            className={`mint-wallet-btn ${pathname === '/mint/wallet' ? 'active' : ''}`}
          >
            Wallet
          </Link>
        </div>
      </header>

      <main className="mint-main">{children}</main>
    </div>
  );
}
