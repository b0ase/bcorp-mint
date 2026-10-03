import { NextRequest, NextResponse } from 'next/server';
import { issueLoginNonce } from '@/lib/auth';
import { loginMessage } from '@shared/lib/bapp-login';

/**
 * POST /api/auth/bwallet/challenge
 *
 * Step 1 of the bApp login (bapp-standard section 3.3): a nonce for the wallet to sign.
 * The origin is embedded in the nonce so the message the wallet signs is bound to this
 * site; the client signs `message` verbatim and posts the result to /verify.
 */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const nonce = issueLoginNonce(origin);
  return NextResponse.json(
    { nonce, origin, message: loginMessage(nonce, origin), expiresInSeconds: 300 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
