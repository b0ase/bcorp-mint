'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isBWalletAvailable, shortIdentityKey, signBWalletChallenge } from './bwallet';

export type AuthMethod = 'handcash' | 'bwallet';

interface AuthState {
  /** Display handle: `$alias` for bWallet, the HandCash handle otherwise. */
  handle: string | null;
  /** Bearer token for API calls when the session is not a cookie (bWallet). */
  authToken: string | null;
  /** BRC-100 identity key when signed in with bWallet. */
  identityKey: string | null;
  method: AuthMethod | null;
  /** What the sign-in button should say before the user is signed in. */
  loginLabel: string;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void | Promise<void>;
  logout: () => void | Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within an <AuthProvider>');
  return ctx;
}

/** Like useAuth, but null outside a provider (for components that may render without one). */
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext);
}

// --- Cookie helper (browser-only) ---

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// --- bWallet session (per tab, in memory + sessionStorage; never a cookie) ---

const SESSION_KEY = 'bmint.session';

type StoredSession = {
  token: string;
  expiresAt: number;
  identityKey: string;
  handle: string | null;
  paymail: string | null;
};

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.token || !s.identityKey || s.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function writeStoredSession(s: StoredSession | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: the session lives in React state only */
  }
}

/**
 * bApp login (bapp-standard section 3.3): the server issues a nonce, the wallet signs it
 * with the identity key, the server verifies and returns a session token.
 */
async function loginWithBWallet(): Promise<StoredSession> {
  const challengeRes = await fetch('/api/auth/bwallet/challenge', { method: 'POST' });
  if (!challengeRes.ok) throw new Error('Could not start wallet login');
  const { nonce, origin } = (await challengeRes.json()) as { nonce: string; origin: string };

  const { identityKey, signature } = await signBWalletChallenge(nonce, origin);

  const verifyRes = await fetch('/api/auth/bwallet/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce, identityKey, signature }),
  });
  const data = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok) throw new Error(data.error || 'Wallet login failed');
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    identityKey: data.identityKey,
    handle: data.handle ?? null,
    paymail: data.paymail ?? null,
  };
}

/**
 * Website auth provider.
 *  - Inside bWallet (or with an injected BRC-100 provider): challenge/response with the
 *    wallet's identity key; the session is a Bearer token kept per tab.
 *  - Otherwise: HandCash OAuth; the session is the server's httpOnly cookie.
 */
export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandle] = useState<string | null>(null);
  const [identityKey, setIdentityKey] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [method, setMethod] = useState<AuthMethod | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWalletAvailable(isBWalletAvailable());
    const stored = readStoredSession();
    if (stored) {
      setMethod('bwallet');
      setAuthToken(stored.token);
      setIdentityKey(stored.identityKey);
      setHandle(stored.handle ?? shortIdentityKey(stored.identityKey));
    } else {
      const hc = getCookie('handcash_handle');
      if (hc) {
        setMethod('handcash');
        setHandle(hc);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async () => {
    if (isBWalletAvailable()) {
      setLoading(true);
      try {
        const s = await loginWithBWallet();
        writeStoredSession(s);
        setMethod('bwallet');
        setAuthToken(s.token);
        setIdentityKey(s.identityKey);
        setHandle(s.handle ?? shortIdentityKey(s.identityKey));
      } catch (err) {
        console.error('[auth] bWallet login failed:', err);
        throw err;
      } finally {
        setLoading(false);
      }
      return;
    }
    window.location.href = '/api/auth/handcash';
  }, []);

  const logout = useCallback(async () => {
    if (method === 'bwallet') {
      writeStoredSession(null);
      setMethod(null);
      setAuthToken(null);
      setIdentityKey(null);
      setHandle(null);
      return;
    }
    window.location.href = '/api/auth/logout';
  }, [method]);

  return (
    <AuthContext.Provider
      value={{
        handle,
        authToken,
        identityKey,
        method,
        loginLabel: walletAvailable ? 'Connect bWallet' : 'Connect HandCash',
        isAuthenticated: !!handle,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Desktop auth provider — gets auth from Electron main process via IPC.
 */
export function DesktopAuthProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandle] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ipc = typeof window !== 'undefined' ? (window as any).mint : null;

  useEffect(() => {
    if (!ipc) {
      setLoading(false);
      return;
    }
    // Load persisted auth state
    (async () => {
      try {
        const state = await ipc.bitsignGetAuth();
        if (state?.handle) {
          setHandle(state.handle);
          setAuthToken(state.authToken);
        }
      } catch {
        // No auth stored
      } finally {
        setLoading(false);
      }
    })();
  }, [ipc]);

  const login = useCallback(async () => {
    if (!ipc) return;
    try {
      const result = await ipc.bitsignLogin();
      if (result?.handle) {
        setHandle(result.handle);
        setAuthToken(result.authToken);
      }
    } catch (err) {
      console.error('[DesktopAuth] login failed:', err);
    }
  }, [ipc]);

  const logout = useCallback(async () => {
    if (!ipc) return;
    try {
      await ipc.bitsignLogout();
    } catch {
      // silent
    }
    setHandle(null);
    setAuthToken(null);
  }, [ipc]);

  return (
    <AuthContext.Provider
      value={{
        handle,
        authToken,
        identityKey: null,
        method: handle ? 'handcash' : null,
        loginLabel: 'Connect HandCash',
        isAuthenticated: !!handle,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
