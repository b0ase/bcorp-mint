import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle, resolveUnifiedUserId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/mint-vault — Save an encrypted bundle to cloud vault.
 * Requires a signed-in user (HandCash or bWallet).
 */
export async function POST(request: NextRequest) {
  const handle = await resolveUserHandle(request);
  if (!handle) {
    return NextResponse.json({ error: 'Authentication required. Sign in with your wallet.' }, { status: 401 });
  }

  // Resolve unified user ID from handle
  const unifiedUserId = await resolveUnifiedUserId(request);
  if (!unifiedUserId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json();

  if (!body.ciphertext || !body.iv || !body.attestation) {
    return NextResponse.json({ error: 'Invalid bundle: missing ciphertext, iv, or attestation' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('mint_cloud_vault')
    .insert({
      user_id: unifiedUserId,
      encrypted_bundle: body,
      name: body.name || '',
      asset_type: body.assetType || 'currency',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[mint-vault] Save failed:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

/**
 * GET /api/mint-vault — List cloud vault entries for the current user.
 */
export async function GET(request: NextRequest) {
  const handle = await resolveUserHandle(request);
  if (!handle) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const unifiedUserId = await resolveUnifiedUserId(request);
  if (!unifiedUserId) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('mint_cloud_vault')
    .select('id, name, asset_type, created_at')
    .eq('user_id', unifiedUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[mint-vault] List failed:', error);
    return NextResponse.json({ error: 'Failed to list entries' }, { status: 500 });
  }

  return NextResponse.json(
    (data || []).map(row => ({
      id: row.id,
      name: row.name,
      assetType: row.asset_type,
      createdAt: row.created_at,
    }))
  );
}
