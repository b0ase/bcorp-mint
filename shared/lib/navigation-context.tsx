'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type NavSection = 'mint' | 'hash' | 'vault' | 'sign' | 'identity';

interface NavigationState {
  currentSection: NavSection;
  navigate: (section: NavSection) => void;
}

const NavigationContext = createContext<NavigationState | null>(null);

export function useNavigation(): NavigationState {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation() must be used within a <NavigationProvider>');
  return ctx;
}

/**
 * Desktop navigation provider — uses local state for section switching.
 */
export function DesktopNavigationProvider({
  children,
  initialSection = 'mint',
}: {
  children: React.ReactNode;
  initialSection?: NavSection;
}) {
  const [currentSection, setCurrentSection] = useState<NavSection>(initialSection);

  const navigate = useCallback((section: NavSection) => {
    setCurrentSection(section);
  }, []);

  return (
    <NavigationContext.Provider value={{ currentSection, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Website navigation provider — derives section from pathname, navigates via router.
 * Must be composed with Next.js router externally.
 */
export function WebNavigationProvider({
  children,
  currentSection,
  onNavigate,
}: {
  children: React.ReactNode;
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
}) {
  return (
    <NavigationContext.Provider value={{ currentSection, navigate: onNavigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

/** Map a pathname to a NavSection */
export function pathnameToSection(pathname: string): NavSection {
  if (pathname.startsWith('/hash')) return 'hash';
  if (pathname.startsWith('/vault')) return 'vault';
  if (pathname.startsWith('/sign')) return 'sign';
  if (pathname.startsWith('/identity')) return 'identity';
  return 'mint';
}

/** Map a NavSection to a pathname */
export function sectionToPathname(section: NavSection): string {
  return `/${section}`;
}
