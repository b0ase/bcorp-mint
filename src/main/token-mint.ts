import { PrivateKey, P2PKH } from '@bsv/sdk';
import { deployBsv21Token, oneSatBroadcaster, fetchPayUtxos } from 'js-1sat-ord';
import { BrowserWindow } from 'electron';
import { loadPrivateKey, loadMasterKey, hasMasterKey } from './keystore';
import { deriveChildKey } from './wallet-derivation';
import { getTreasuryAddress, MINT_FEE_SATS } from './treasury';
import type { WalletProviderType } from './wallet-provider';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

/**
 * Guard: BSV-21 token minting requires a local PrivateKey.
 * BRC-100 wallets (MetaNet Desktop) manage UTXOs internally and cannot
 * provide the raw PrivateKey that js-1sat-ord's deployBsv21Token() requires.
 */
export function assertLocalProvider(activeProvider: WalletProviderType): void {
  if (activeProvider === 'metanet') {
    throw new Error(
      'BSV-21 token minting requires Local Wallet. ' +
      'MetaNet Desktop uses BRC-100 which manages transactions internally. ' +
      'Switch to Local Wallet to mint tokens.'
    );
  }
}

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
 * Resolve the signing private key for token minting.
 * If master key exists and derivation provided, derives child key for $TOKEN/{slug}.
 */
async function resolveTokenKey(derivation?: { protocol: string; slug: string }): Promise<PrivateKey> {
  if (derivation && await hasMasterKey()) {
    const masterHex = await loadMasterKey();
    return deriveChildKey(masterHex, derivation.protocol, derivation.slug);
  }
  const wif = await loadPrivateKey();
  return PrivateKey.fromWif(wif);
}

/**
 * Mint a BSV-21 token for a stamped image.
 * Private key is resolved internally — never crosses IPC.
 */
export async function mintStampToken(payload: {
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
  derivation?: { protocol: string; slug: string };
}): Promise<{ tokenId: string; txid: string }> {
  const privateKey = await resolveTokenKey(payload.derivation);
  const address = privateKey.toPublicKey().toAddress();

  const payUtxos = await fetchPayUtxos(address);
  if (!payUtxos.length) {
    throw new Error('No payment UTXOs found — need satoshis for minting');
  }

  const iconData = payload.iconDataB64 || MINIMAL_PNG;
  const iconType = payload.iconContentType || 'image/png';
  const symbol = payload.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'STAMP';

  // Resolve treasury fee
  let additionalPayments: Array<{ to: string; amount: number }> = [];
  try {
    const treasuryAddr = await getTreasuryAddress();
    additionalPayments = [{ to: treasuryAddr, amount: MINT_FEE_SATS }];
  } catch {
    // Don't block minting if treasury resolution fails
  }

  const { tx } = await deployBsv21Token({
    symbol,
    icon: { dataB64: iconData, contentType: iconType },
    utxos: payUtxos,
    initialDistribution: { address, tokens: 1 },
    paymentPk: privateKey,
    destinationAddress: address,
    satsPerKb: 1,
    additionalPayments,
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
  derivation?: { protocol: string; slug: string };
}>): Promise<Array<{ tokenId: string; txid: string; index: number }>> {
  const results: Array<{ tokenId: string; txid: string; index: number }> = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    sendMintProgress({ completed: i, total: pieces.length, stage: `Minting ${i + 1}/${pieces.length}...` });

    try {
      const privateKey = await resolveTokenKey(piece.derivation);
      const address = privateKey.toPublicKey().toAddress();

      const payUtxos = await fetchPayUtxos(address);
      if (!payUtxos.length) {
        throw new Error('No payment UTXOs — need satoshis');
      }

      const iconData = piece.iconDataB64 || MINIMAL_PNG;
      const iconType = piece.iconContentType || 'image/png';
      const symbol = piece.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'STAMP';

      // Resolve treasury fee (once per batch, cached after first call)
      let additionalPayments: Array<{ to: string; amount: number }> = [];
      try {
        const treasuryAddr = await getTreasuryAddress();
        additionalPayments = [{ to: treasuryAddr, amount: MINT_FEE_SATS }];
      } catch {
        // Skip treasury fee if resolution fails
      }

      const { tx } = await deployBsv21Token({
        symbol,
        icon: { dataB64: iconData, contentType: iconType },
        utxos: payUtxos,
        initialDistribution: { address, tokens: 1 },
        paymentPk: privateKey,
        destinationAddress: address,
        satsPerKb: 1,
        additionalPayments,
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
