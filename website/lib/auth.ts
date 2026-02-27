import { NextRequest } from 'next/server';
import { getUserAccount } from './handcash';

/**
 * Resolves the user's handle from the request.
 * Tries handcash_handle cookie first, then falls back to
 * looking up the profile via handcash_auth_token.
 */
export async function resolveUserHandle(request: NextRequest): Promise<string | null> {
    // 0. Check Authorization: Bearer header (desktop app sends this)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7);
        try {
            const account = getUserAccount(bearerToken);
            if (account) {
                const { publicProfile } = await account.profile.getCurrentProfile();
                if (publicProfile?.handle) return publicProfile.handle;
            }
        } catch (e) {
            console.error('[resolveUserHandle] Bearer token lookup failed:', e);
        }
    }

    // 1. Try the handle cookie (fast path)
    const handleCookie = request.cookies.get('handcash_handle')?.value;
    if (handleCookie) return handleCookie;

    // 2. Fall back to auth token -> HandCash API lookup
    const authToken = request.cookies.get('handcash_auth_token')?.value;
    if (!authToken) return null;

    try {
        const account = getUserAccount(authToken);
        if (!account) return null;
        const { publicProfile } = await account.profile.getCurrentProfile();
        return publicProfile?.handle || null;
    } catch (e) {
        console.error('[resolveUserHandle] HandCash lookup failed:', e);
        return null;
    }
}

/**
 * Cookie domain for production — ensures cookies work on both
 * bitcoin-mint.com and www.bitcoin-mint.com
 */
export function getCookieDomain(): string | undefined {
    if (process.env.NODE_ENV !== 'production') return undefined;
    return '.bitcoin-mint.com';
}
