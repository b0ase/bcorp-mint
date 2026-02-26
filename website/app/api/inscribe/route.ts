import { NextRequest, NextResponse } from 'next/server';

const HC_APP_ID = process.env.HANDCASH_APP_ID || '';
const HC_APP_SECRET = process.env.HANDCASH_APP_SECRET || '';

interface HashEntry {
  filename: string;
  sha256: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('bm_handcash_token')?.value;
  if (!authToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!HC_APP_ID || !HC_APP_SECRET) {
    return NextResponse.json({ error: 'HandCash not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const hashes: HashEntry[] = body.hashes;

    if (!hashes?.length) {
      return NextResponse.json({ error: 'No hashes provided' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const opReturnData = [
      'BCORP_MINT_HASH',
      `ts:${timestamp}`,
      ...hashes.map((h) => `${h.filename}:${h.sha256}`),
    ];

    const paymentBody = {
      description: `Bitcoin Mint Hash Inscription - ${hashes.length} file(s)`,
      appAction: 'ip-hash-inscription',
      receivers: [],
      attachment: {
        format: 'json',
        value: {
          protocol: 'BCORP_IP_HASH',
          data: opReturnData,
        },
      },
    };

    const res = await fetch('https://cloud.handcash.io/v3/wallet/pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'app-id': HC_APP_ID,
        'app-secret': HC_APP_SECRET,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(paymentBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Inscribe] HandCash Pay failed:', res.status, errText);
      return NextResponse.json(
        { error: `Inscription failed (${res.status})` },
        { status: 502 }
      );
    }

    const result = await res.json();
    if (!result.transactionId) {
      return NextResponse.json({ error: 'No transaction ID returned' }, { status: 502 });
    }

    return NextResponse.json({ txid: result.transactionId });
  } catch (error) {
    console.error('[Inscribe] Error:', error);
    return NextResponse.json({ error: 'Inscription failed' }, { status: 500 });
  }
}
