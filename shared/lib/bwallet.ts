'use client';

/**
 * bWallet integration (bApp standard v0.1, github.com/bitcoin-apps-suite/bapp-standard).
 *
 * The Mint is listed in bWallet's Apps tab as "bMint". bWallet opens it either
 *   - in-frame: a cross-origin <iframe> between the wallet's top bar and tab bar, or
 *   - full screen: the wallet's native WebView, which injects `window.CWI` (BRC-100).
 *
 * In-frame there is no injection; the BRC-100 XDM substrate (postMessage to
 * window.parent) is used instead. `@bsv/sdk`'s WalletClient with substrate 'auto'
 * handles both, so one connect path covers both hosting modes.
 *
 * Detection is a layout hint only (any page can fake a user agent). Nothing here
 * stores anything: the identity key lives in React state for the session.
 */

import { useEffect, useState } from 'react';

export type BWalletEnv = {
  /** Running inside bWallet (full screen or in-frame). */
  inWallet: boolean;
  /** Running inside bWallet's main frame as an iframe. */
  inFrame: boolean;
  /** Any Yours-derived mobile wallet (compatibility marker). */
  inYoursMobile: boolean;
};

const NOT_IN_WALLET: BWalletEnv = { inWallet: false, inFrame: false, inYoursMobile: false };

/** Detect the host from the user agent and frame ancestry. Safe to call during SSR. */
export function detectBWallet(): BWalletEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return NOT_IN_WALLET;
  const ua = navigator.userAgent || '';
  const inYoursMobile = /\bYoursWalletMobile\/\d+/.test(ua);
  const uaWallet = /\bbWallet\/\d+/.test(ua);
  let inFrame = false;
  try {
    inFrame = window.parent !== window;
  } catch {
    inFrame = true;
  }
  // In-frame the iframe keeps the system WebView UA (no bWallet marker), so check the
  // referrer / ancestor origin for the wallet's own origins (capacitor://localhost on iOS,
  // https://localhost on Android).
  let frameFromWallet = false;
  if (inFrame) {
    try {
      const ancestors = (window.location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
      const list = ancestors ? Array.from(ancestors) : [];
      const ref = document.referrer ? [new URL(document.referrer).origin] : [];
      frameFromWallet = [...list, ...ref].some(
        (o) => o === 'capacitor://localhost' || o === 'https://localhost' || o === 'http://localhost',
      );
    } catch {
      frameFromWallet = false;
    }
  }
  const inWallet = uaWallet || inYoursMobile || frameFromWallet;
  return { inWallet, inFrame: inWallet && inFrame, inYoursMobile };
}

/** React hook: resolves after mount so SSR and the first client render agree. */
export function useBWallet(): BWalletEnv {
  const [env, setEnv] = useState<BWalletEnv>(NOT_IN_WALLET);
  useEffect(() => {
    setEnv(detectBWallet());
  }, []);
  return env;
}

export type BWalletIdentity = {
  /** 33-byte compressed public key, hex. The user's account id in a bApp. */
  identityKey: string;
};

type WalletLike = {
  isAuthenticated: (args: Record<string, never>) => Promise<{ authenticated: boolean }>;
  waitForAuthentication: (args: Record<string, never>) => Promise<unknown>;
  getPublicKey: (args: { identityKey: true }) => Promise<{ publicKey: string }>;
};

let cachedClient: WalletLike | null = null;

/**
 * The wallet interface for the current host: `window.CWI` when the wallet injected it
 * (full-screen browser), otherwise `@bsv/sdk`'s WalletClient on the 'auto' substrate,
 * which falls back to XDM (postMessage) when the page is framed by the wallet.
 */
async function getWalletClient(): Promise<WalletLike> {
  if (cachedClient) return cachedClient;
  const injected = (window as unknown as { CWI?: WalletLike }).CWI;
  if (injected && typeof injected.getPublicKey === 'function') {
    cachedClient = injected;
    return injected;
  }
  const sdk = await import('@bsv/sdk');
  // 'auto' tries window.CWI, then the XDM substrate (iframe → parent), then others.
  const client = new sdk.WalletClient('auto') as unknown as WalletLike;
  cachedClient = client;
  return client;
}

/** "Connect" per the bApp spec: get the identity key. No passwords, no emails. */
export async function connectBWallet(): Promise<BWalletIdentity> {
  const wallet = await getWalletClient();
  const { authenticated } = await wallet.isAuthenticated({});
  if (!authenticated) await wallet.waitForAuthentication({});
  const { publicKey } = await wallet.getPublicKey({ identityKey: true });
  return { identityKey: publicKey };
}

/** Shorten an identity key for display: 02ab12…9f3e */
export function shortIdentityKey(key: string): string {
  if (!key || key.length < 12) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
