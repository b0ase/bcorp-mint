import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables for Supabase. Database features may be limited.');
}

// Client for browser-side usage (public)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);

// Admin client for server-side usage (privileged)
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseServiceKey || supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);


/**
 * Maps a HandCash handle to a persistent unified user record.
 *
 * `authToken` IS DELIBERATELY IGNORED. It used to be encrypted into
 * `unified_users.encrypted_auth_token` on every sign-in. That column was written here and
 * read NOWHERE — checked across the whole b0ase portfolio, every occurrence in every
 * project is an `.update()`, never a `.select()`. It bought nothing and cost a great deal:
 *
 *   - A HandCash auth token can SIGN and SPEND as the user. Storing them made the shared
 *     database a wallet-draining kit rather than a list of accounts.
 *   - The "encrypted" part was decorative. lib/encryption.ts keyed off
 *     API_KEY_ENCRYPTION_SECRET and FELL BACK TO SUPABASE_SERVICE_ROLE_KEY — so whoever
 *     held the credential needed to read the ciphertext also held the key that opened it.
 *     (Its final fallback was a hardcoded literal in the source.)
 *
 * Nothing is lost: sessions authenticate from the httpOnly handcash_auth_token cookie, and
 * a fresh token arrives from the OAuth callback on every sign-in. The parameter is kept in
 * the signature so existing callers stay valid.
 *
 * Ported from bit-sign d6ce808. See bit-sign/docs/DESIGN-privacy-and-key-custody.md §6.2.
 */
export async function mapHandCashUser(profile: { handle: string, displayName?: string, avatarUrl?: string }, authToken?: string) {
    void authToken;
    // 1. Check if HandCash identity already exists
    const { data: identity, error: identityError } = await supabaseAdmin
        .from('user_identities')
        .select('unified_user_id')
        .eq('provider', 'handcash')
        .eq('provider_user_id', profile.handle)
        .maybeSingle();

    if (identityError) {
        console.error('[Supabase] Error checking HandCash identity:', identityError);
        throw identityError;
    }

    if (identity) {
        // Identity exists, update the unified user if needed
        const { data: user, error: userError } = await supabaseAdmin
            .from('unified_users')
            .update({
                display_name: profile.displayName || profile.handle,
                avatar_url: profile.avatarUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', identity.unified_user_id)
            .select()
            .single();

        if (userError) {
            console.error('[Supabase] Error updating unified user:', userError);
        }


        return user;
    }

    // 2. No identity found, create new unified user
    const { data: newUser, error: createUserError } = await supabaseAdmin
        .from('unified_users')
        .insert({
            display_name: profile.displayName || profile.handle,
            avatar_url: profile.avatarUrl,
        })
        .select()
        .single();

    if (createUserError || !newUser) {
        console.error('[Supabase] Error creating unified user:', createUserError);
        throw createUserError;
    }

    // 3. Link the HandCash identity
    const { error: linkError } = await supabaseAdmin
        .from('user_identities')
        .insert({
            unified_user_id: newUser.id,
            provider: 'handcash',
            provider_user_id: profile.handle,
            provider_handle: `$${profile.handle}`,
        });

    if (linkError) {
        console.error('[Supabase] Error linking HandCash identity:', linkError);
    }


    return newUser;
}

/**
 * Maps a bWallet identity (BRC-100 identity key) to a persistent unified user record.
 * `provider_user_id` is the identity key: handles can be renamed, keys cannot. The
 * display name follows the current $handle, else a shortened key.
 */
export async function mapBWalletUser(identity: { identityKey: string; handle: string | null; paymail: string | null }) {
    const displayName = identity.handle ?? `${identity.identityKey.slice(0, 6)}…${identity.identityKey.slice(-4)}`;

    const { data: existing, error: lookupError } = await supabaseAdmin
        .from('user_identities')
        .select('unified_user_id')
        .eq('provider', 'bwallet')
        .eq('provider_user_id', identity.identityKey)
        .maybeSingle();

    if (lookupError) {
        console.error('[Supabase] Error checking bWallet identity:', lookupError);
        throw lookupError;
    }

    if (existing) {
        const [{ data: user }] = await Promise.all([
            supabaseAdmin
                .from('unified_users')
                .update({ display_name: displayName, updated_at: new Date().toISOString() })
                .eq('id', existing.unified_user_id)
                .select()
                .single(),
            supabaseAdmin
                .from('user_identities')
                .update({ provider_handle: identity.handle })
                .eq('provider', 'bwallet')
                .eq('provider_user_id', identity.identityKey),
        ]);
        return user;
    }

    const { data: newUser, error: createUserError } = await supabaseAdmin
        .from('unified_users')
        .insert({ display_name: displayName })
        .select()
        .single();

    if (createUserError || !newUser) {
        console.error('[Supabase] Error creating unified user:', createUserError);
        throw createUserError;
    }

    const { error: linkError } = await supabaseAdmin
        .from('user_identities')
        .insert({
            unified_user_id: newUser.id,
            provider: 'bwallet',
            provider_user_id: identity.identityKey,
            provider_handle: identity.handle,
        });

    if (linkError) {
        console.error('[Supabase] Error linking bWallet identity:', linkError);
    }

    return newUser;
}

export default supabase;
