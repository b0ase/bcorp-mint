import { PrivateKey } from '@bsv/sdk';
import { deployBsv21Token, oneSatBroadcaster, fetchPayUtxos } from 'js-1sat-ord';
import { BrowserWindow } from 'electron';
import { loadPrivateKey } from './keystore';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

// Default 1x1 PNG icon (fallback)
const MINIMAL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function broadcastToken(tx: any): Promise<{ tokenId: string; txid: string }> {
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

/**
 * Mint a BSV-21 token for a stamped image.
 * Private key is loaded from keystore internally — never crosses IPC.
 */
export async function mintStampToken(payload: {
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
}): Promise<{ tokenId: string; txid: string }> {
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  const payUtxos = await fetchPayUtxos(address);
  if (!payUtxos.length) {
    throw new Error('No payment UTXOs found — need satoshis for minting');
  }

  const iconData = payload.iconDataB64 || MINIMAL_PNG;
  const iconType = payload.iconContentType || 'image/png';
  const symbol = payload.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'STAMP';

  const { tx } = await deployBsv21Token({
    symbol,
    icon: { dataB64: iconData, contentType: iconType },
    utxos: payUtxos,
    initialDistribution: { address, tokens: 1 },
    paymentPk: privateKey,
    destinationAddress: address,
    satsPerKb: 1
  });

  return broadcastToken(tx);
}

function sendMintProgress(data: { completed: number; total: number; stage: string }) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('mint-progress', data);
}

/**
 * Batch mint BSV-21 tokens for multiple pieces (frames/segments).
 */
export async function batchMintTokens(pieces: Array<{
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
}>): Promise<Array<{ tokenId: string; txid: string; index: number }>> {
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  const results: Array<{ tokenId: string; txid: string; index: number }> = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    sendMintProgress({ completed: i, total: pieces.length, stage: `Minting ${i + 1}/${pieces.length}...` });

    try {
      const payUtxos = await fetchPayUtxos(address);
      if (!payUtxos.length) {
        throw new Error('No payment UTXOs — need satoshis');
      }

      const iconData = piece.iconDataB64 || MINIMAL_PNG;
      const iconType = piece.iconContentType || 'image/png';
      const symbol = piece.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'STAMP';

      const { tx } = await deployBsv21Token({
        symbol,
        icon: { dataB64: iconData, contentType: iconType },
        utxos: payUtxos,
        initialDistribution: { address, tokens: 1 },
        paymentPk: privateKey,
        destinationAddress: address,
        satsPerKb: 1
      });

      const result = await broadcastToken(tx);
      results.push({ ...result, index: i });

      // Rate limit: 200ms between mints
      if (i < pieces.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`Batch mint failed at piece ${i}:`, err);
      results.push({ tokenId: '', txid: '', index: i });
    }
  }

  sendMintProgress({ completed: pieces.length, total: pieces.length, stage: 'Done' });
  return results;
}
