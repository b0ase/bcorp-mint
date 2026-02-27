'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthState {
  handle: string | null;
  authToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within an <AuthProvider>');
  return ctx;
}

// --- Cookie helper (browser-only) ---

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Website auth provider — reads handle from cookies, login redirects to OAuth.
 */
export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHandle(getCookie('handcash_handle'));
    setLoading(false);
  }, []);

  const login = useCallback(() => {
    window.location.href = '/api/auth/handcash';
  }, []);

  const logout = useCallback(() => {
    window.location.href = '/api/auth/logout';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        handle,
        authToken: getCookie('handcash_auth_token'),
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
