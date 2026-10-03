import { NextRequest, NextResponse } from 'next/server';
import { consumeLoginNonce, issueBWalletSession } from '@/lib/auth';
import { lookupBWalletHandle } from '@/lib/bwallet-paymail';
import { mapBWalletUser } from '@/lib/supabase';
import { IDENTITY_KEY_RE, LOGIN_KEY_ID, LOGIN_PROTOCOL, loginMessage } from '@shared/lib/bapp-login';

/**
 * POST /api/auth/bwallet/verify  { nonce, identityKey, signature }
 *
 * Step 2 of the bApp login. The wallet signed loginMessage(nonce, origin) with
 * createSignature({ protocolID: [2,'bapp login'], keyID: '1', counterparty: 'anyone' }).
 * Because the counterparty is 'anyone', the signing key is derivable from the identity
 * key alone, so ProtoWallet('anyone').verifySignature() checks it with no secret of ours.
 *
 * On success: the identity's $handle is resolved from the bWallet paymail server, the
 * user is mapped to a unified user record, and a signed session token is returned.
 * No passwords, no cookies.
 */
export async function POST(request: NextRequest) {
  let body: { nonce?: unknown; identityKey?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { nonce, identityKey, signature } = body;
  if (typeof nonce !== 'string' || typeof identityKey !== 'string' || typeof signature !== 'string') {
    return NextResponse.json({ error: 'nonce, identityKey and signature are required' }, { status: 400 });
  }
  if (!IDENTITY_KEY_RE.test(identityKey)) {
    return NextResponse.json({ error: 'identityKey must be a 33-byte compressed public key (hex)' }, { status: 400 });
  }
  if (!/^[0-9a-fA-F]{16,200}$/.test(signature)) {
    return NextResponse.json({ error: 'signature must be DER hex' }, { status: 400 });
  }

  const issued = consumeLoginNonce(nonce);
  if (!issued) {
    return NextResponse.json({ error: 'Challenge expired or already used. Try again.' }, { status: 401 });
  }

  let valid = false;
  try {
    const { ProtoWallet, Utils } = await import('@bsv/sdk');
    const anyone = new ProtoWallet('anyone');
    const result = await anyone.verifySignature({
      data: Utils.toArray(loginMessage(nonce, issued.origin), 'utf8'),
      signature: Utils.toArray(signature, 'hex'),
      protocolID: LOGIN_PROTOCOL,
      keyID: LOGIN_KEY_ID,
      counterparty: identityKey,
    });
    valid = result.valid === true;
  } catch (e) {
    console.warn('[auth/bwallet] signature check failed:', e instanceof Error ? e.message : e);
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: 'Signature does not match the identity key' }, { status: 401 });
  }

  const lookup = await lookupBWalletHandle(identityKey);

  try {
    await mapBWalletUser({ identityKey, handle: lookup.handle, paymail: lookup.paymail });
  } catch (e) {
    // The session is still valid without the database; vault and envelopes will say "User not found".
    console.error('[auth/bwallet] user mapping failed:', e);
  }

  let session: { token: string; expiresAt: number };
  try {
    session = issueBWalletSession({ identityKey, handle: lookup.handle, paymail: lookup.paymail });
  } catch (e) {
    console.error('[auth/bwallet]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Login is not configured on this server' }, { status: 500 });
  }

  return NextResponse.json(
    {
      token: session.token,
      expiresAt: session.expiresAt,
      identityKey,
      handle: lookup.handle,
      paymail: lookup.paymail,
      ordAddress: lookup.ordAddress,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
