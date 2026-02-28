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

/**
 * Compact section nav — gold edges, brown bodies, gold text/icons.
 * Active tab gets a brighter gold treatment.
 */
export default function TopNav() {
  const { currentSection, navigate } = useNavigation();

  return (
    <nav className="flex items-center gap-1 flex-shrink-0">
      {tabs.map(({ section, label, icon: Icon }) => {
        const active = currentSection === section;
        return (
          <button
            key={section}
            onClick={() => navigate(section)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all duration-150"
            style={{
              color: active ? '#e6c665' : '#c9a84c',
              background: active
                ? 'linear-gradient(180deg, #2a2010 0%, #1a1508 100%)'
                : 'linear-gradient(180deg, #1a1508 0%, #110e05 100%)',
              border: `1px solid ${active ? 'rgba(201, 168, 76, 0.5)' : 'rgba(201, 168, 76, 0.2)'}`,
              boxShadow: active
                ? '0 0 8px rgba(201, 168, 76, 0.15), inset 0 1px 0 rgba(230, 198, 101, 0.1)'
                : 'inset 0 1px 0 rgba(230, 198, 101, 0.05)',
            }}
          >
            <Icon size={13} strokeWidth={active ? 2.5 : 1.5} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
