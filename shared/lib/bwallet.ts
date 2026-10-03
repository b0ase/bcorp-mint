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
 * handles both, so one client covers both hosting modes.
 *
 * Identity (spec section 3): the BRC-100 identity key is the account id. The user's
 * $handle is their bWallet paymail (`alias@bwallet.space`), registered against the
 * identity key on the bWallet paymail server and resolvable from the key through a
 * public lookup. There are no passwords: a server session is opened by signing a
 * nonce with createSignature (section 3.3).
 *
 * Payments and inscriptions (section 4): BRC-100 createAction calls; the wallet funds,
 * prompts, signs and broadcasts.
 *
 * Detection is a layout hint only. Nothing here stores anything: the identity key and
 * handle live in React state for the session.
 */

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Host detection
// ---------------------------------------------------------------------------

export type BWalletEnv = {
  /** Running inside bWallet (full screen or in-frame). */
  inWallet: boolean;
  /** Running inside bWallet's main frame as an iframe. */
  inFrame: boolean;
  /** Any Yours-derived mobile wallet (compatibility marker). */
  inYoursMobile: boolean;
};

const NOT_IN_WALLET: BWalletEnv = { inWallet: false, inFrame: false, inYoursMobile: false };

const WALLET_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);

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
  // ancestor origin / referrer for the wallet's own origins (capacitor://localhost on
  // iOS, https://localhost on Android).
  let frameFromWallet = false;
  if (inFrame) {
    try {
      const ancestors = (window.location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
      const list = ancestors ? Array.from(ancestors) : [];
      const ref = document.referrer ? [new URL(document.referrer).origin] : [];
      frameFromWallet = [...list, ...ref].some((o) => WALLET_ORIGINS.has(o));
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

type InjectedWallet = { getPublicKey?: unknown };

function hasInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false;
  const cwi = (window as unknown as { CWI?: InjectedWallet }).CWI;
  return !!cwi && typeof cwi.getPublicKey === 'function';
}

/**
 * Can this page reach a BRC-100 wallet right now? True inside bWallet (frame or full
 * screen) and in any browser that injects `window.CWI` (the Yours / bWallet extension).
 */
export function isBWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return detectBWallet().inWallet || hasInjectedProvider();
}

// ---------------------------------------------------------------------------
// Wallet client (BRC-100)
// ---------------------------------------------------------------------------

export type { ProtocolID } from './bapp-login';
import type { ProtocolID } from './bapp-login';

export type CreateActionOutput = {
  lockingScript: string;
  satoshis: number;
  outputDescription: string;
  basket?: string;
  customInstructions?: string;
  tags?: string[];
};

export type CreateActionArgs = {
  description: string;
  outputs: CreateActionOutput[];
  labels?: string[];
};

/** The subset of the BRC-100 WalletInterface the Mint uses. */
export type BWalletClient = {
  isAuthenticated: (args: Record<string, never>) => Promise<{ authenticated: boolean }>;
  waitForAuthentication: (args: Record<string, never>) => Promise<unknown>;
  getPublicKey: (args: {
    identityKey?: true;
    protocolID?: ProtocolID;
    keyID?: string;
    counterparty?: string;
    forSelf?: boolean;
  }) => Promise<{ publicKey: string }>;
  createSignature: (args: {
    data: number[];
    protocolID: ProtocolID;
    keyID: string;
    counterparty?: string;
  }) => Promise<{ signature: number[] }>;
  createAction: (args: CreateActionArgs) => Promise<{ txid?: string; tx?: number[] }>;
};

let cachedClient: BWalletClient | null = null;

/**
 * The wallet interface for the current host: `window.CWI` when the wallet injected it
 * (full-screen browser, extension), otherwise `@bsv/sdk`'s WalletClient on the 'auto'
 * substrate, which falls back to XDM (postMessage) when the page is framed by the wallet.
 */
export async function getBWalletClient(): Promise<BWalletClient> {
  if (cachedClient) return cachedClient;
  const injected = (window as unknown as { CWI?: BWalletClient }).CWI;
  if (injected && typeof injected.getPublicKey === 'function') {
    cachedClient = injected;
    return injected;
  }
  const sdk = await import('@bsv/sdk');
  // 'auto' tries window.CWI, then the XDM substrate (iframe → parent), then others.
  cachedClient = new sdk.WalletClient('auto') as unknown as BWalletClient;
  return cachedClient;
}

/** Forget the cached client (after a disconnect, or if the host changed). */
export function resetBWalletClient() {
  cachedClient = null;
}

// ---------------------------------------------------------------------------
// Identity and $handle
// ---------------------------------------------------------------------------

export type BWalletIdentity = {
  /** 33-byte compressed public key, hex. The user's account id in a bApp. */
  identityKey: string;
  /** `$alias` when the identity has a bWallet paymail, else null. */
  handle: string | null;
  /** `alias@bwallet.space` when registered, else null. */
  paymail: string | null;
  /** Where the user receives tokens and ordinals, when the paymail profile publishes it. */
  ordAddress: string | null;
};

export type BWalletHandleLookup = Pick<BWalletIdentity, 'handle' | 'paymail' | 'ordAddress'>;

const NO_HANDLE: BWalletHandleLookup = { handle: null, paymail: null, ordAddress: null };

/** `alias@domain` → `$alias` */
export function handleFromPaymail(paymail: string | null | undefined): string | null {
  if (!paymail) return null;
  const alias = paymail.split('@')[0]?.trim();
  return alias ? `$${alias.toLowerCase()}` : null;
}

/**
 * Resolve the $handle for an identity key. The lookup is public (the paymail server
 * maps identity key → paymail) and goes through this origin's /api/bwallet/handle so
 * the browser does not depend on the paymail server's CORS policy.
 */
export async function lookupBWalletHandle(identityKey: string): Promise<BWalletHandleLookup> {
  try {
    const res = await fetch(`/api/bwallet/handle?key=${encodeURIComponent(identityKey)}`, {
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!res.ok) return NO_HANDLE;
    const j = (await res.json()) as Partial<BWalletHandleLookup>;
    const paymail = typeof j.paymail === 'string' ? j.paymail : null;
    return {
      paymail,
      handle: typeof j.handle === 'string' ? j.handle : handleFromPaymail(paymail),
      ordAddress: typeof j.ordAddress === 'string' ? j.ordAddress : null,
    };
  } catch {
    return NO_HANDLE;
  }
}

/** The identity key only (section 3.2). Prompts the wallet for permission the first time. */
export async function getBWalletIdentityKey(): Promise<string> {
  const wallet = await getBWalletClient();
  const { authenticated } = await wallet.isAuthenticated({});
  if (!authenticated) await wallet.waitForAuthentication({});
  const { publicKey } = await wallet.getPublicKey({ identityKey: true });
  return publicKey;
}

/** "Connect" per the bApp spec: identity key plus the $handle it resolves to. */
export async function connectBWallet(): Promise<BWalletIdentity> {
  const identityKey = await getBWalletIdentityKey();
  const lookup = await lookupBWalletHandle(identityKey);
  return { identityKey, ...lookup };
}

/** Shorten an identity key for display: 02ab12…9f3e */
export function shortIdentityKey(key: string): string {
  if (!key || key.length < 12) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/** What to show for a connected bWallet user: the $handle, else the shortened key. */
export function displayNameFor(identity: Pick<BWalletIdentity, 'identityKey' | 'handle'>): string {
  return identity.handle ?? shortIdentityKey(identity.identityKey);
}

// ---------------------------------------------------------------------------
// Login: challenge and response (section 3.3)
// ---------------------------------------------------------------------------

// Protocol, key id and message format live in bapp-login.ts (server-safe) so the API
// route that verifies the signature uses exactly the same bytes.
export { LOGIN_PROTOCOL, LOGIN_KEY_ID, loginMessage } from './bapp-login';
import { LOGIN_PROTOCOL, LOGIN_KEY_ID, loginMessage } from './bapp-login';

export type SignedChallenge = { identityKey: string; signature: string };

/** Sign a server nonce with the wallet. `counterparty: 'anyone'` lets the server verify with only the identity key. */
export async function signBWalletChallenge(nonce: string, origin: string): Promise<SignedChallenge> {
  const wallet = await getBWalletClient();
  const identityKey = await getBWalletIdentityKey();
  const data = Array.from(new TextEncoder().encode(loginMessage(nonce, origin)));
  const { signature } = await wallet.createSignature({
    data,
    protocolID: LOGIN_PROTOCOL,
    keyID: LOGIN_KEY_ID,
    counterparty: 'anyone',
  });
  return { identityKey, signature: toHex(signature) };
}

// ---------------------------------------------------------------------------
// Payments and inscriptions (section 4)
// ---------------------------------------------------------------------------

/** Protocol for message signatures that third parties verify against the identity key. */
export const SIGN_PROTOCOL: ProtocolID = [1, 'mint sign'];

/** Build a transaction through the wallet. It funds, prompts, signs and broadcasts. */
export async function bwalletCreateAction(args: CreateActionArgs): Promise<{ txid: string }> {
  const wallet = await getBWalletClient();
  const result = await wallet.createAction({
    ...args,
    description: clampDescription(args.description),
    outputs: args.outputs.map((o) => ({ ...o, outputDescription: clampDescription(o.outputDescription) })),
  });
  if (!result.txid) throw new Error('Wallet did not return a transaction id');
  return { txid: result.txid };
}

/** OP_FALSE OP_RETURN <field>... as a locking script hex. */
export function opReturnScriptHex(fields: (string | Uint8Array)[]): string {
  const parts: number[] = [0x00, 0x6a];
  for (const field of fields) {
    const bytes = typeof field === 'string' ? new TextEncoder().encode(field) : field;
    if (bytes.length < 76) parts.push(bytes.length);
    else if (bytes.length < 256) parts.push(0x4c, bytes.length);
    else parts.push(0x4d, bytes.length & 0xff, (bytes.length >> 8) & 0xff);
    parts.push(...bytes);
  }
  return parts.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Write data fields to chain as an OP_RETURN output paid for by the wallet. */
export async function inscribeOpReturnViaBWallet(
  fields: (string | Uint8Array)[],
  description: string,
): Promise<{ txid: string }> {
  return bwalletCreateAction({
    description,
    outputs: [{ lockingScript: opReturnScriptHex(fields), satoshis: 0, outputDescription: 'Inscription' }],
    labels: ['bmint', 'inscription'],
  });
}

/**
 * Sign a message with a key derived from the identity key under SIGN_PROTOCOL, so
 * anyone holding the identity key can verify it (counterparty 'anyone').
 */
export async function bwalletSignMessage(message: string): Promise<{ signature: string; address: string; identityKey: string }> {
  const wallet = await getBWalletClient();
  const identityKey = await getBWalletIdentityKey();
  const data = Array.from(new TextEncoder().encode(message));
  const { signature } = await wallet.createSignature({
    data,
    protocolID: SIGN_PROTOCOL,
    keyID: 'message',
    counterparty: 'anyone',
  });
  const sdk = await import('@bsv/sdk');
  const address = sdk.PublicKey.fromString(identityKey).toAddress().toString();
  return { signature: toHex(signature), address, identityKey };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function toHex(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

/** BRC-100 descriptions are 5 to 50 bytes. */
function clampDescription(s: string): string {
  const enc = new TextEncoder();
  let out = s.trim();
  if (enc.encode(out).length < 5) out = `${out} note`.trim().padEnd(5, '.');
  while (enc.encode(out).length > 50) out = out.slice(0, -1);
  return out;
}
