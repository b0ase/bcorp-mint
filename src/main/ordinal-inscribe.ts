// Single 1Sat ordinal inscription.
//
// Distinct from ./bsv.ts (OP_RETURN-only stamp metadata) and ./token-mint.ts
// (BSV-21 token deployment). This module creates a real 1Sat ordinal where
// the file content (image, JSON manifest, etc.) lives ON-CHAIN as the
// inscription envelope. That's what users mean when they say "mint this as
// an ordinal."
//
// Built on js-1sat-ord ^0.1.x (legacy SDK). Migration path documented in
// @b0ase/creator-tool-core README — when we move to @1sat/wallet or
// @1sat/actions, only this file changes.

import { PrivateKey } from '@bsv/sdk';
import { createOrdinals, fetchPayUtxos, oneSatBroadcaster } from 'js-1sat-ord';
import { hasPrivateKey, loadPrivateKey } from './keystore';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

type MapMetadata = Record<string, string>;

export type InscribeOrdinalPayload = {
  /** Base64-encoded content (no data:url prefix). */
  dataB64: string;
  /** MIME type, e.g. 'image/png', 'image/jpeg', 'application/json'. */
  contentType: string;
  /** Optional MAP metadata for indexer discovery (app, type, title, parent, etc.). */
  map?: MapMetadata;
  /** Optional destination address for the ordinal output. Defaults to keystore address. */
  destinationAddress?: string;
};

export type InscribeOrdinalResult = {
  txid: string;
  ordinalId: string;
};

async function broadcast(rawHex: string): Promise<string> {
  // Try 1sat broadcaster first (better for indexer pickup).
  try {
    const oneSat = oneSatBroadcaster();
    // The broadcaster's `broadcast` accepts a Transaction; we pass via JSON-shape
    // to avoid round-tripping. Easiest path is WoC fallback for raw hex.
    void oneSat;
  } catch {
    // ignore
  }
  // WhatsOnChain raw broadcast — universally reliable.
  const res = await fetch(`${WHATSONCHAIN_API}/tx/raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txhex: rawHex })
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Inscription broadcast failed (${res.status}): ${err}`);
  }
  return (await res.text()).replace(/"/g, '').trim();
}

export async function inscribeOrdinal(payload: InscribeOrdinalPayload): Promise<InscribeOrdinalResult> {
  if (!(await hasPrivateKey())) {
    throw new Error('No stamper key configured. Import a private key in Settings before inscribing.');
  }

  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();
  const dest = payload.destinationAddress || address;

  const utxos = await fetchPayUtxos(address);
  if (!utxos.length) {
    throw new Error('No payment UTXOs — fund the stamper wallet before inscribing.');
  }

  // Build the inscription destination.
  const destinations = [{
    address: dest,
    inscription: {
      dataB64: payload.dataB64,
      contentType: payload.contentType
    }
  }];

  // MAP metadata — passed through to inscription envelope for indexer discovery.
  // js-1sat-ord expects a flat key/value object under metaData.
  const metaData = payload.map
    ? { app: payload.map.app ?? 'b0ase-mint', type: payload.map.type ?? 'asset', ...payload.map }
    : { app: 'b0ase-mint', type: 'asset' };

  const result = await createOrdinals({
    utxos,
    destinations,
    paymentPk: privateKey,
    changeAddress: address,
    satsPerKb: 1,
    metaData
  });

  const tx = result.tx;
  const rawHex = tx.toHex();
  const txid = await broadcast(rawHex);
  // 1Sat ordinal id convention: "<txid>_<vout>" — the first output is the inscription.
  const ordinalId = `${txid}_0`;
  return { txid, ordinalId };
}
