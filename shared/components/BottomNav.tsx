'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PenTool, Hash, Lock, FileSignature, Fingerprint } from 'lucide-react';

const tabs = [
  { href: '/mint', label: 'Mint', icon: PenTool },
  { href: '/hash', label: 'Hash', icon: Hash },
  { href: '/vault', label: 'Vault', icon: Lock },
  { href: '/sign', label: 'Sign', icon: FileSignature },
  { href: '/identity', label: 'Identity', icon: Fingerprint },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur-xl safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                active
                  ? 'text-amber-400'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-bold tracking-wider uppercase">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
