'use client';

import React, { createContext, useContext } from 'react';
import type { MintPlatform } from './platform';

const PlatformContext = createContext<MintPlatform | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PlatformProvider({ value, children }: { value: MintPlatform; children: any }) {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): MintPlatform {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform() must be used within a <PlatformProvider>');
  return ctx;
}
