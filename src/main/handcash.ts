import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

let authToken: string | null = null;
let cachedProfile: { handle: string; balance: number } | null = null;

const HC_APP_ID = process.env.HANDCASH_APP_ID || '';
const HC_APP_SECRET = process.env.HANDCASH_APP_SECRET || '';

/**
 * Get HandCash OAuth redirect URL for wallet connection.
 * Opens a local HTTP server to catch the callback token.
 */
export async function getRedirectUrl(): Promise<string> {
  const callbackPort = 17381;
  const redirectUri = `http://localhost:${callbackPort}/callback`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${callbackPort}`);
      const token = url.searchParams.get('authToken');

      if (token) {
        authToken = token;
        cachedProfile = null;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Wallet connected! You can close this window.</h1></body></html>');
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Connection failed. Please try again.</h1></body></html>');
      }

      server.close();
    });

    server.listen(callbackPort, () => {
      const connectUrl = `https://app.handcash.io/#/authorizeApp?appId=${HC_APP_ID}&redirectUrl=${encodeURIComponent(redirectUri)}`;
      resolve(connectUrl);
    });

    server.on('error', reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth callback timeout'));
    }, 300000);
  });
}

export function setAuthToken(token: string): void {
  authToken = token;
  cachedProfile = null;
}

export function isConnected(): boolean {
  return !!authToken;
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

export function disconnect(): void {
  authToken = null;
  cachedProfile = null;
}

export function getWalletState() {
  return {
    connected: isConnected(),
    handle: cachedProfile?.handle ?? null,
    authToken,
    balance: cachedProfile?.balance ?? null
  };
}
