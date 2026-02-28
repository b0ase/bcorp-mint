import { NextResponse } from 'next/server';

/**
 * Broadcast a raw BSV transaction to multiple endpoints:
 * 1. WhatsOnChain (general BSV network)
 * 2. GorillaPool ARC (1Sat Ordinals indexing)
 */
export async function POST(request: Request) {
  try {
    const { rawHex } = await request.json();
    if (!rawHex || typeof rawHex !== 'string') {
      return NextResponse.json({ error: 'Missing rawHex' }, { status: 400 });
    }

    // Primary: WhatsOnChain
    const wocRes = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txhex: rawHex }),
    });

    if (!wocRes.ok) {
      const text = await wocRes.text();
      return NextResponse.json({ error: `Broadcast failed: ${text}` }, { status: 502 });
    }

    const txid = (await wocRes.text()).replace(/"/g, '');

    // Secondary: GorillaPool ARC (for 1Sat Ordinals indexing, fire-and-forget)
    const rawBytes = new Uint8Array(rawHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    fetch('https://arc.gorillapool.io/v1/tx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-CallbackUrl': '',
      },
      body: rawBytes,
    }).catch(() => {
      // Non-critical: 1Sat indexer will pick up from mempool anyway
    });

    return NextResponse.json({ txid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Broadcast failed' },
      { status: 500 }
    );
  }
}
