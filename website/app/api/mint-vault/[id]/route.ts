import { NextRequest, NextResponse } from 'next/server';
import { resolveUserHandle, resolveUnifiedUserId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/mint-vault/:id — Retrieve an encrypted bundle by ID.
 * Only the owner can access their entries.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const handle = await resolveUserHandle(request);
  if (!handle) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const unifiedUserId = await resolveUnifiedUserId(request);
  if (!unifiedUserId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('mint_cloud_vault')
    .select('encrypted_bundle')
    .eq('id', id)
    .eq('user_id', unifiedUserId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  return NextResponse.json(data.encrypted_bundle);
}

/**
 * DELETE /api/mint-vault/:id — Delete a cloud vault entry.
 * Only the owner can delete their entries.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const handle = await resolveUserHandle(request);
  if (!handle) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const unifiedUserId = await resolveUnifiedUserId(request);
  if (!unifiedUserId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('mint_cloud_vault')
    .delete()
    .eq('id', id)
    .eq('user_id', unifiedUserId);

  if (error) {
    console.error('[mint-vault] Delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
