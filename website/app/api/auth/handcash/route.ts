import { handCashConnect } from '@/lib/handcash';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  if (!handCashConnect) {
    return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/api/auth/handcash/callback`;

  const redirectUrl = handCashConnect.getRedirectionUrl({
    referrerUrl: callbackUrl,
    permissions: ['PAY', 'USER_PUBLIC_PROFILE', 'SIGN_DATA'] as any,
  });

  return NextResponse.redirect(redirectUrl);
}
