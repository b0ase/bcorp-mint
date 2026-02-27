import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

let authToken: string | null = null;
let cachedProfile: { handle: string; balance: number } | null = null;

const HC_APP_ID = process.env.HANDCASH_APP_ID || '';
const HC_APP_SECRET = process.env.HANDCASH_APP_SECRET || '';
const CALLBACK_PORT = 17381;

// --- Persistence ---

function authFilePath(): string {
  return path.join(app.getPath('userData'), 'bitsign-auth.json');
}

export async function loadPersistedAuth(): Promise<void> {
  try {
    const raw = await fs.readFile(authFilePath(), 'utf-8');
    const data = JSON.parse(raw);
    if (data.authToken) {
      authToken = data.authToken;
      cachedProfile = data.profile || null;
    }
  } catch {
    // No persisted auth — that's fine
  }
}

async function persistAuth(): Promise<void> {
  try {
    await fs.writeFile(
      authFilePath(),
      JSON.stringify({ authToken, profile: cachedProfile }),
      'utf-8',
    );
  } catch (err) {
    console.error('[handcash] Failed to persist auth:', err);
  }
}

async function clearPersistedAuth(): Promise<void> {
  try {
    await fs.unlink(authFilePath());
  } catch {
    // File didn't exist
  }
}

// --- OAuth flow ---

let callbackServer: http.Server | null = null;

/**
 * Starts the OAuth flow: opens a local HTTP server, returns the HandCash connect URL.
 * Resolves only AFTER the callback arrives with the token.
 */
export function startOAuthFlow(): Promise<{ handle: string; authToken: string }> {
  // Kill any lingering server
  if (callbackServer) {
    try { callbackServer.close(); } catch { /* ignore */ }
    callbackServer = null;
  }

  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;

  return new Promise((resolve, reject) => {
    callbackServer = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      const token = url.searchParams.get('authToken');

      if (token) {
        authToken = token;
        cachedProfile = null;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h1>Connected! You can close this window.</h1></body></html>');

        callbackServer?.close();
        callbackServer = null;

        // Fetch profile, then resolve
        const profile = await getProfile();
        if (profile) {
          await persistAuth();
          resolve({ handle: profile.handle, authToken: token });
        } else {
          resolve({ handle: 'unknown', authToken: token });
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Connection failed. Please try again.</h1></body></html>');
        callbackServer?.close();
        callbackServer = null;
        reject(new Error('No auth token in callback'));
      }
    });

    callbackServer.listen(CALLBACK_PORT, () => {
      // Caller should open this URL externally
    });

    callbackServer.on('error', (err) => {
      callbackServer = null;
      reject(err);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (callbackServer) {
        callbackServer.close();
        callbackServer = null;
        reject(new Error('OAuth callback timeout'));
      }
    }, 300000);
  });
}

export function getOAuthUrl(): string {
  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;
  return `https://app.handcash.io/#/authorizeApp?appId=${HC_APP_ID}&redirectUrl=${encodeURIComponent(redirectUri)}`;
}

/**
 * @deprecated Use startOAuthFlow() + getOAuthUrl() instead.
 * Kept for backward compatibility with existing wallet-connect handler.
 */
export async function getRedirectUrl(): Promise<string> {
  return getOAuthUrl();
}

export function setAuthToken(token: string): void {
  authToken = token;
  cachedProfile = null;
}

export function isConnected(): boolean {
  return !!authToken;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function getProfile(): Promise<{ handle: string; balance: number } | null> {
  if (!authToken) return null;
  if (cachedProfile) return cachedProfile;

  try {
    const res = await fetch('https://cloud.handcash.io/v2/profile/currentUserProfile', {
      headers: { 'app-id': HC_APP_ID, 'app-secret': HC_APP_SECRET, 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) return null;
    const data = await res.json() as { publicProfile?: { handle?: string; paymail?: string } };
    cachedProfile = {
      handle: data.publicProfile?.handle || 'unknown',
      balance: 0
    };
    return cachedProfile;
  } catch {
    return null;
  }
}

export async function disconnect(): Promise<void> {
  authToken = null;
  cachedProfile = null;
  await clearPersistedAuth();
}

export function getWalletState() {
  return {
    connected: isConnected(),
    handle: cachedProfile?.handle ?? null,
    authToken,
    balance: cachedProfile?.balance ?? null
  };
}

/**
 * Get BitSign auth state (handle + token) — used by DesktopAuthProvider.
 */
export function getBitsignAuthState() {
  return {
    handle: cachedProfile?.handle ?? null,
    authToken,
  };
}
