import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { rawHex } = await request.json();
    if (!rawHex || typeof rawHex !== 'string') {
      return NextResponse.json({ error: 'Missing rawHex' }, { status: 400 });
    }

    const res = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txhex: rawHex }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Broadcast failed: ${text}` }, { status: 502 });
    }

    const txid = await res.text();
    return NextResponse.json({ txid: txid.replace(/"/g, '') });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Broadcast failed' },
      { status: 500 }
    );
  }
}
