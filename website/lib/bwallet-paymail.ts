/**
 * bWallet paymail server (server-side client).
 *
 * bWallet users' $handles are paymail aliases, `alias@bwallet.space`, registered against
 * their BRC-100 identity key on the wallet's paymail server. The identity key → paymail
 * mapping is public (yours-mobile `src/mobile/names/paymail.ts`, `lookupPaymail`):
 *
 *   GET {api}/api/paymail/lookup?key=<identityKey>   → { paymail }   (no paymail: not found)
 *   GET {api}/api/paymail/id/<paymail>               → bsvalias public profile (404 = alias free)
 *
 * Nothing is stored here and nothing about the user is sent other than the public key
 * the user has already shown us.
 */

const PAYMAIL_API = (process.env.BWALLET_PAYMAIL_API || 'https://pay.bwallet.space').replace(/\/$/, '');
const TIMEOUT_MS = 5000;

export type HandleLookup = {
  identityKey: string;
  paymail: string | null;
  /** `$alias` (the paymail's local part), or null. */
  handle: string | null;
  /** Where the user receives tokens and ordinals, when the profile publishes it. */
  ordAddress: string | null;
};

export function handleFromPaymail(paymail: string | null): string | null {
  if (!paymail) return null;
  const alias = paymail.split('@')[0]?.trim().toLowerCase();
  return alias ? `$${alias}` : null;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Resolve an identity key to the user's bWallet paymail / $handle (and ordinals address when published). */
export async function lookupBWalletHandle(identityKey: string): Promise<HandleLookup> {
  const lookup = await getJson(`${PAYMAIL_API}/api/paymail/lookup?key=${encodeURIComponent(identityKey)}`);
  const paymail = pickString(lookup, ['paymail']);
  let ordAddress = pickString(lookup, ['ordAddress', 'ord_address']);
  if (paymail && !ordAddress) {
    const profile = await getJson(`${PAYMAIL_API}/api/paymail/id/${encodeURIComponent(paymail)}`);
    ordAddress = pickString(profile, ['ordAddress', 'ord_address', 'ordinalsAddress']);
  }
  return { identityKey, paymail, handle: handleFromPaymail(paymail), ordAddress };
}
