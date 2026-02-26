/**
 * Treasury configuration for The Bitcoin Corporation Mint.
 *
 * All minting/inscription fees are sent to the treasury address.
 * HandCash handle: $Bitcoin-Mint.com
 * Paymail: Bitcoin-Mint.com@handcash.io
 */

const TREASURY_HANDLE = 'Bitcoin-Mint.com';
const TREASURY_PAYMAIL = `${TREASURY_HANDLE}@handcash.io`;
const MINT_FEE_USD = 0.01; // 1 penny
const MINT_FEE_SATS = 100; // fallback for local wallet (approx 1 penny at ~$50/BSV)

let _cachedAddress: string | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 3600_000; // 1 hour

/**
 * Resolve the treasury BSV address from paymail.
 * Caches the result for 1 hour.
 */
export async function getTreasuryAddress(): Promise<string> {
  if (_cachedAddress && Date.now() < _cacheExpiry) {
    return _cachedAddress;
  }

  try {
    // Step 1: Discover paymail capabilities
    const wellKnown = await fetch('https://handcash.io/.well-known/bsvalias', {
      headers: { Accept: 'application/json' },
    });

    if (!wellKnown.ok) throw new Error(`Paymail discovery failed: ${wellKnown.status}`);

    const capabilities = (await wellKnown.json()) as {
      capabilities?: Record<string, string>;
    };

    // Step 2: Find address resolution endpoint
    // Standard capability: "paymentDestination" or "5f1323cddf31"
    const addrTemplate =
      capabilities?.capabilities?.['paymentDestination'] ||
      capabilities?.capabilities?.['5f1323cddf31'] ||
      capabilities?.capabilities?.['2a40af698840'];

    if (!addrTemplate) {
      throw new Error('Paymail: no address resolution capability found');
    }

    const addrUrl = addrTemplate
      .replace('{alias}', TREASURY_HANDLE)
      .replace('{domain.tld}', 'handcash.io');

    // Step 3: POST to resolve address
    const addrRes = await fetch(addrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderName: 'The Mint',
        senderHandle: 'mint@bitcoin-mint.com',
        dt: new Date().toISOString(),
        amount: MINT_FEE_SATS,
        purpose: 'mint-fee',
      }),
    });

    if (!addrRes.ok) throw new Error(`Paymail address resolution failed: ${addrRes.status}`);

    const data = (await addrRes.json()) as { output?: string; address?: string };
    const address = data.output || data.address;

    if (!address) throw new Error('Paymail returned no address');

    _cachedAddress = address;
    _cacheExpiry = Date.now() + CACHE_TTL;
    return address;
  } catch (err) {
    console.error('[treasury] paymail resolution failed:', err);
    // If resolution fails, don't block the user's transaction — skip the fee
    throw err;
  }
}

export { TREASURY_HANDLE, TREASURY_PAYMAIL, MINT_FEE_USD, MINT_FEE_SATS };
