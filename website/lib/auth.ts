import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getUserAccount } from './handcash';

/**
 * Resolve a HandCash handle from an auth token by asking HandCash for the
 * token's profile. This is the ONLY way a handle is established server-side:
 * plain handle cookies (handcash_handle / b0ase_user_handle) are client-
 * writable and are never trusted for authentication.
 *
 * Results are cached briefly (keyed by a hash of the token) to avoid a
 * HandCash round-trip on every request.
 */
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

/**
 * Resolves the authenticated user's handle from the request.
 * Accepts only credentials that are verified server-side with HandCash:
 *   - Authorization: Bearer <HandCash auth token> (desktop app)
 *   - httpOnly handcash_auth_token / b0ase_handcash_token cookie
 */
export async function resolveUserHandle(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const handle = await resolveHandleFromAuthToken(authHeader.slice(7).trim());
        if (handle) return handle;
    }

    const authToken =
        request.cookies.get('handcash_auth_token')?.value ??
        request.cookies.get('b0ase_handcash_token')?.value;
    return resolveHandleFromAuthToken(authToken);
}

/**
 * Cookie domain for production — ensures cookies work on both
 * bitcoin-mint.com and www.bitcoin-mint.com
 */
export function getCookieDomain(): string | undefined {
    if (process.env.NODE_ENV !== 'production') return undefined;
    return '.bitcoin-mint.com';
}
