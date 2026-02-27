'use client';

import React, { createContext, useContext, useMemo } from 'react';

interface ApiClient {
  get: (path: string, opts?: RequestInit) => Promise<Response>;
  post: (path: string, body?: unknown, opts?: RequestInit) => Promise<Response>;
  patch: (path: string, body?: unknown, opts?: RequestInit) => Promise<Response>;
  del: (path: string, opts?: RequestInit) => Promise<Response>;
}

const ApiClientContext = createContext<ApiClient | null>(null);

export function useApiClient(): ApiClient {
  const ctx = useContext(ApiClientContext);
  if (!ctx) throw new Error('useApiClient() must be used within an <ApiClientProvider>');
  return ctx;
}

function buildClient(baseUrl: string, authToken: string | null): ApiClient {
  const headers = (extra?: HeadersInit): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    if (extra) {
      const entries = extra instanceof Headers
        ? Array.from(extra.entries())
        : Array.isArray(extra) ? extra : Object.entries(extra);
      for (const [k, v] of entries) h[k] = v;
    }
    return h;
  };

  const url = (path: string) => baseUrl ? `${baseUrl}${path}` : path;

  return {
    get: (path, opts) =>
      fetch(url(path), { ...opts, method: 'GET', headers: headers(opts?.headers as HeadersInit), credentials: baseUrl ? undefined : 'include' }),
    post: (path, body, opts) =>
      fetch(url(path), { ...opts, method: 'POST', headers: headers(opts?.headers as HeadersInit), body: body ? JSON.stringify(body) : undefined, credentials: baseUrl ? undefined : 'include' }),
    patch: (path, body, opts) =>
      fetch(url(path), { ...opts, method: 'PATCH', headers: headers(opts?.headers as HeadersInit), body: body ? JSON.stringify(body) : undefined, credentials: baseUrl ? undefined : 'include' }),
    del: (path, opts) =>
      fetch(url(path), { ...opts, method: 'DELETE', headers: headers(opts?.headers as HeadersInit), credentials: baseUrl ? undefined : 'include' }),
  };
}

/**
 * Website API client — relative URLs, cookies auto-sent.
 */
export function WebApiClientProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => buildClient('', null), []);
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

/**
 * Desktop API client — absolute URLs to bitcoin-mint.com, Bearer token auth.
 */
export function DesktopApiClientProvider({
  children,
  authToken,
}: {
  children: React.ReactNode;
  authToken: string | null;
}) {
  const client = useMemo(
    () => buildClient('https://bitcoin-mint.com', authToken),
    [authToken],
  );
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}
