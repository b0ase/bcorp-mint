import { handCashConnect } from '@/lib/handcash';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authToken = request.nextUrl.searchParams.get('authToken');
  const origin = request.nextUrl.origin;

  if (!authToken) {
    return NextResponse.redirect(new URL('/hash?error=no_token', origin));
  }

  if (!handCashConnect) {
    return NextResponse.redirect(new URL('/hash?error=not_configured', origin));
  }

  try {
    const account = handCashConnect.getAccountFromAuthToken(authToken);
    const { publicProfile } = await account.profile.getCurrentProfile();
    const handle = publicProfile.handle;

    const response = NextResponse.redirect(new URL('/hash', origin));

    const cookieOptions = {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    };

    response.cookies.set('bm_handcash_token', authToken, cookieOptions);
    response.cookies.set('bm_user_handle', handle, {
      ...cookieOptions,
      httpOnly: false, // Readable by client for display
    });

    return response;
  } catch (error) {
    console.error('[BitcoinMint] HandCash callback error:', error);
    return NextResponse.redirect(new URL('/hash?error=auth_failed', origin));
  }
}
