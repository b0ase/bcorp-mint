// AI provider key storage — local only.
//
// Privacy contract: keys live in localStorage under a single namespace.
// They never leave this machine via telemetry. They're passed into
// AIProvider.generate() at call time, never persisted server-side.
//
// Future hardening: swap localStorage for Electron's safeStorage (OS
// keychain) via an IPC bridge. Today's localStorage is fine for v1.

const NS = 'b0ase.ai-keys.v1';

export type ProviderKey =
  | 'bsvapi'         // bsvapi_sk_... or just the secret part
  | 'bsvapi-base'    // override base URL (defaults to https://bsvapi.com)
  | 'grok-imagine'   // xai api key
  | 'atlascloud'     // atlascloud api key
  | 'replicate'      // replicate api key
  | 'comfyui-local'; // local ComfyUI base URL (e.g., http://127.0.0.1:8188)

type Store = Partial<Record<ProviderKey, string>>;

function load(): Store {
  try {
    const raw = localStorage.getItem(NS);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function save(s: Store): void {
  try {
    localStorage.setItem(NS, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function getKey(k: ProviderKey): string | undefined {
  return load()[k];
}

export function setKey(k: ProviderKey, value: string | undefined): void {
  const s = load();
  if (!value) {
    delete s[k];
  } else {
    s[k] = value;
  }
  save(s);
}

export function listKeys(): Store {
  return load();
}

export function clearAll(): void {
  try { localStorage.removeItem(NS); } catch { /* ignore */ }
}
