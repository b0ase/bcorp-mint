import { NextRequest } from 'next/server';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getUserAccount } from './handcash';
import { supabaseAdmin } from './supabase';

/**
 * Two ways a request proves who the user is. Both are verified server-side on every
 * request; plain handle cookies are client-writable and never trusted.
 *
 *   HandCash   Authorization: Bearer <HandCash auth token> (desktop app), or the httpOnly
 *              handcash_auth_token cookie. The token's profile is fetched from HandCash.
 *   bWallet    Authorization: Bearer bw1.<claims>.<hmac>: a session this server issued
 *              after the wallet signed our nonce with its BRC-100 identity key
 *              (bapp-standard section 3.3). Sent as a header, not a cookie, because iOS
 *              partitions cookies when the Mint runs inside bWallet's frame.
 */

// ---------------------------------------------------------------------------
// HandCash
// ---------------------------------------------------------------------------

const HANDLE_CACHE_TTL_MS = 60_000;
const HANDLE_CACHE_MAX = 500;
const handleCache = new Map<string, { handle: string; expires: number }>();

function tokenKey(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export async function resolveHandleFromAuthToken(authToken: string | null | undefined): Promise<string | null> {
    if (!authToken) return null;
    const key = tokenKey(authToken);
    const cached = handleCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.handle;

    try {
        const account = getUserAccount(authToken);
        if (!account) return null;
        const { publicProfile } = await account.profile.getCurrentProfile();
        const handle = publicProfile?.handle || null;
        if (handle) {
            if (handleCache.size >= HANDLE_CACHE_MAX) handleCache.clear();
            handleCache.set(key, { handle, expires: Date.now() + HANDLE_CACHE_TTL_MS });
        }
        return handle;
    } catch (e) {
        console.error('[auth] HandCash profile lookup failed:', e);
        return null;
    }
}

// ---------------------------------------------------------------------------
// bWallet sessions (BRC-100 challenge and response)
// ---------------------------------------------------------------------------

export const SESSION_PREFIX = 'bw1';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, like the HandCash cookie
const NONCE_TTL_MS = 5 * 60 * 1000;

export type BWalletClaims = {
    identityKey: string;
    paymail: string | null;
    /** `$alias` when the identity has a bWallet paymail. */
    handle: string | null;
    /** Unix ms. */
    exp: number;
};

function sessionSecret(): string {
    const s = process.env.MINT_SESSION_SECRET || process.env.API_KEY_ENCRYPTION_SECRET;
    if (s) return s;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('MINT_SESSION_SECRET is not set');
    }
    return 'dev-only-insecure-mint-session-secret';
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const fromB64url = (s: string) => Buffer.from(s, 'base64url');

function hmac(payload: string): string {
    return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** A nonce for the login challenge. Stateless: the origin and issue time ride inside it, signed. */
export function issueLoginNonce(origin: string): string {
    const payload = b64url(JSON.stringify({ t: Date.now(), r: randomBytes(16).toString('hex'), o: origin }));
    return `${payload}.${hmac(`nonce.${payload}`)}`;
}

// Nonces are single-use. Best effort per server instance; the short TTL bounds any replay window.
const usedNonces = new Map<string, number>();
function pruneUsed(now: number) {
    for (const [k, t] of usedNonces) if (now - t > NONCE_TTL_MS) usedNonces.delete(k);
}

/** Checks the nonce's signature, age and single use; returns the origin it was issued for. */
export function consumeLoginNonce(nonce: string): { origin: string } | null {
    const [payload, sig] = nonce.split('.');
    if (!payload || !sig || !safeEqual(sig, hmac(`nonce.${payload}`))) return null;
    let claims: { t?: number; o?: string };
    try {
        claims = JSON.parse(fromB64url(payload).toString('utf8'));
    } catch {
        return null;
    }
    const now = Date.now();
    if (typeof claims.t !== 'number' || typeof claims.o !== 'string') return null;
    if (now - claims.t > NONCE_TTL_MS || claims.t > now + 60_000) return null;
    pruneUsed(now);
    if (usedNonces.has(nonce)) return null;
    usedNonces.set(nonce, now);
    return { origin: claims.o };
}

export function issueBWalletSession(claims: Omit<BWalletClaims, 'exp'>): { token: string; expiresAt: number } {
    const exp = Date.now() + SESSION_TTL_MS;
    const payload = b64url(JSON.stringify({ ...claims, exp } satisfies BWalletClaims));
    return { token: `${SESSION_PREFIX}.${payload}.${hmac(`session.${payload}`)}`, expiresAt: exp };
}

export function verifyBWalletSession(token: string): BWalletClaims | null {
    const [prefix, payload, sig] = token.split('.');
    if (prefix !== SESSION_PREFIX || !payload || !sig) return null;
    if (!safeEqual(sig, hmac(`session.${payload}`))) return null;
    try {
        const claims = JSON.parse(fromB64url(payload).toString('utf8')) as BWalletClaims;
        if (typeof claims.identityKey !== 'string' || typeof claims.exp !== 'number') return null;
        if (claims.exp < Date.now()) return null;
        return claims;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type Session =
    | { provider: 'handcash'; handle: string; providerUserId: string }
    | { provider: 'bwallet'; handle: string; providerUserId: string; identityKey: string; paymail: string | null; displayHandle: string | null };

/**
 * The authenticated user, from whichever credential the request carries.
 * For bWallet the `handle` used as the user's name in records is the paymail
 * (`alias@bwallet.space`), falling back to the identity key when none is claimed.
 */
export async function resolveSession(request: NextRequest): Promise<Session | null> {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token.startsWith(`${SESSION_PREFIX}.`)) {
            const claims = verifyBWalletSession(token);
            if (!claims) return null;
            return {
                provider: 'bwallet',
                handle: claims.paymail ?? claims.identityKey,
                providerUserId: claims.identityKey,
                identityKey: claims.identityKey,
                paymail: claims.paymail,
                displayHandle: claims.handle,
            };
        }
        const handle = await resolveHandleFromAuthToken(token);
        if (handle) return { provider: 'handcash', handle, providerUserId: handle };
    }

    const authToken =
        request.cookies.get('handcash_auth_token')?.value ??
        request.cookies.get('b0ase_handcash_token')?.value;
    const handle = await resolveHandleFromAuthToken(authToken);
    return handle ? { provider: 'handcash', handle, providerUserId: handle } : null;
}

/** The user's handle string, or null when the request carries no valid credential. */
export async function resolveUserHandle(request: NextRequest): Promise<string | null> {
    const session = await resolveSession(request);
    return session?.handle ?? null;
}

/** The unified_users id behind the request's identity (user_identities row), or null. */
export async function resolveUnifiedUserId(request: NextRequest): Promise<string | null> {
    const session = await resolveSession(request);
    if (!session) return null;
    const { data } = await supabaseAdmin
        .from('user_identities')
        .select('unified_user_id')
        .eq('provider', session.provider)
        .eq('provider_user_id', session.providerUserId)
        .maybeSingle();
    return data?.unified_user_id ?? null;
}

/**
 * Cookie domain for production — ensures cookies work on both
 * bitcoin-mint.com and www.bitcoin-mint.com
 */
export function getCookieDomain(): string | undefined {
    if (process.env.NODE_ENV !== 'production') return undefined;
    return '.bitcoin-mint.com';
}
