import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL('/', origin));

  response.cookies.delete('handcash_auth_token');
  response.cookies.delete('handcash_handle');
  // Also clear legacy cookies
  response.cookies.delete('bm_handcash_token');
  response.cookies.delete('bm_user_handle');

  return response;
}
