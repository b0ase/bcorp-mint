import { NextRequest, NextResponse } from 'next/server';
import { lookupBWalletHandle } from '@/lib/bwallet-paymail';
import { IDENTITY_KEY_RE } from '@shared/lib/bapp-login';

/**
 * GET /api/bwallet/handle?key=<identityKey>
 *
 * Resolves a BRC-100 identity key to the user's bWallet $handle (paymail alias). A
 * same-origin proxy for the paymail server's public lookup, so the browser does not
 * depend on that server's CORS policy. Public data in, public data out; not cached.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  if (!IDENTITY_KEY_RE.test(key)) {
    return NextResponse.json({ error: 'key must be a 33-byte compressed public key (hex)' }, { status: 400 });
  }
  const lookup = await lookupBWalletHandle(key);
  return NextResponse.json(lookup, { headers: { 'Cache-Control': 'private, no-store' } });
}
