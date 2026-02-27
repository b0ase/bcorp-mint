'use client';

import { PenTool, Hash, Lock, FileSignature, Fingerprint } from 'lucide-react';
import { useNavigation, type NavSection } from '@shared/lib/navigation-context';

const tabs: { section: NavSection; label: string; icon: typeof PenTool }[] = [
  { section: 'mint', label: 'Mint', icon: PenTool },
  { section: 'hash', label: 'Hash', icon: Hash },
  { section: 'vault', label: 'Vault', icon: Lock },
  { section: 'sign', label: 'Sign', icon: FileSignature },
  { section: 'identity', label: 'Identity', icon: Fingerprint },
];

export default function BottomNav() {
  const { currentSection, navigate } = useNavigation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur-xl safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {tabs.map(({ section, label, icon: Icon }) => {
          const active = currentSection === section;
          return (
            <button
              key={section}
              onClick={() => navigate(section)}
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
            </button>
          );
        })}
      </div>
    </nav>
  );
}
