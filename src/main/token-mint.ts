import { PrivateKey } from '@bsv/sdk';
import { deployBsv21Token, oneSatBroadcaster, fetchPayUtxos } from 'js-1sat-ord';
import { loadPrivateKey } from './keystore';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

/**
 * Mint a BSV-21 token for a stamped image.
 * Private key is loaded from keystore internally — never crosses IPC.
 */
export async function mintStampToken(payload: {
  path: string;
  hash: string;
  name: string;
}): Promise<{ tokenId: string; txid: string }> {
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  const payUtxos = await fetchPayUtxos(address);
  if (!payUtxos.length) {
    throw new Error('No payment UTXOs found — need satoshis for minting');
  }

  // Minimal 1x1 PNG icon
  const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  const symbol = payload.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'STAMP';

  const { tx } = await deployBsv21Token({
    symbol,
    icon: { dataB64: minimalPng, contentType: 'image/png' },
    utxos: payUtxos,
    initialDistribution: { address, tokens: 1 },
    paymentPk: privateKey,
    destinationAddress: address,
    satsPerKb: 1
  });

  // Try 1sat broadcaster first
  let result = await tx.broadcast(oneSatBroadcaster());

  if (result.status !== 'success') {
    // Fallback to WhatsOnChain
    const res = await fetch(`${WHATSONCHAIN_API}/tx/raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txhex: tx.toHex() })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Token mint broadcast failed: ${err}`);
    }
    const txid = (await res.text()).replace(/"/g, '').trim();
    return { tokenId: `${txid}_0`, txid };
  }

  return { tokenId: `${result.txid}_0`, txid: result.txid! };
}
