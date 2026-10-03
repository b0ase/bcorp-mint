/**
 * The wallet provider the Mint is currently routing through.
 *
 * `browserPlatform` is a module-level object with no React state, so the wallet
 * manager hook publishes its choice here and the platform's inscribe / mint / sign
 * methods consult it. `null` means the local keystore (mint-bridge) path.
 */

import type { WalletProvider } from './wallet-provider';

let active: WalletProvider | null = null;
const listeners = new Set<() => void>();

export function setActiveProvider(provider: WalletProvider | null) {
  active = provider;
  listeners.forEach((l) => l());
}

export function getActiveProvider(): WalletProvider | null {
  return active;
}

/** The active provider when it can build transactions itself (BRC-100 createAction). */
export function getActiveActionProvider(): WalletProvider | null {
  return active && active.supportsCreateAction && active.createAction ? active : null;
}

export function subscribeActiveProvider(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
