'use client';

import { PenTool, Hash, Lock, FileSignature, Fingerprint } from 'lucide-react';
import { useNavigation, type NavSection } from '@shared/lib/navigation-context';

const ALL_TABS: { section: NavSection; label: string; icon: typeof PenTool }[] = [
  { section: 'mint', label: 'Mint', icon: PenTool },
  { section: 'hash', label: 'Hash', icon: Hash },
  { section: 'vault', label: 'Vault', icon: Lock },
  { section: 'sign', label: 'Sign', icon: FileSignature },
  { section: 'identity', label: 'Identity', icon: Fingerprint },
];

type Props = {
  /** Which sections to show. Defaults to all of them. */
  sections?: NavSection[];
};

/**
 * The web shell's section bar. It is a normal flex child at the bottom of the
 * app frame (not position: fixed), so it never overlaps content and the frame
 * can drop it entirely when the Mint runs inside bWallet.
 */
export default function BottomNav({ sections }: Props) {
  const { currentSection, navigate } = useNavigation();
  const tabs = sections ? ALL_TABS.filter((t) => sections.includes(t.section)) : ALL_TABS;

  return (
    <nav
      className="bottom-nav flex-shrink-0 border-t border-white/10 bg-black/90 backdrop-blur-xl safe-bottom"
      aria-label="Sections"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {tabs.map(({ section, label, icon: Icon }) => {
          const active = currentSection === section;
          return (
            <button
              key={section}
              type="button"
              onClick={() => navigate(section)}
              aria-current={active ? 'page' : undefined}
              className={`bottom-nav-btn flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] px-3 py-2 rounded-lg transition-colors ${
                active ? 'is-active text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
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
