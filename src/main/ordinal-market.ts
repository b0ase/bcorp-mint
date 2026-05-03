// 1Sat ordinal marketplace operations.
//
// Client-side participation in the 1sat market protocol. Listings produced
// here are real BSV transactions and visible to any 1sat indexer (1sat.market,
// bmovies-exchange, future exchange.npg-x.com, etc.).
//
// Built on js-1sat-ord ^0.1.x — same library the existing inscription flow
// uses, no new deps. Migration to @1sat/actions or future @bsv/simple
// marketplace methods is a single-file swap.

import { PrivateKey, Transaction } from '@bsv/sdk';
import {
  createOrdListings,
  cancelOrdListings,
  purchaseOrdListing,
  fetchPayUtxos,
  fetchNftUtxos
} from 'js-1sat-ord';
import { hasPrivateKey, loadPrivateKey } from './keystore';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';
const ONESAT_API = 'https://1sat-api-production.up.railway.app';

async function broadcastViaWoC(rawHex: string): Promise<string> {
  const res = await fetch(`${WHATSONCHAIN_API}/tx/raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txhex: rawHex })
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Broadcast failed (${res.status}): ${err}`);
  }
  return (await res.text()).replace(/"/g, '').trim();
}

// ── Create listing ──────────────────────────────────────────────────────

export type CreateListingPayload = {
  /** The ordinal to list — typically the txid_vout returned by inscribeOrdinal. */
  ordinalTxid: string;
  ordinalVout: number;
  /** Price in satoshis. */
  priceSats: number;
  /** Optional payout address. Defaults to the keystore stamper address. */
  payAddress?: string;
};

export type CreateListingResult = {
  listingTxid: string;
  listingVout: number;
  priceSats: number;
};

export async function createListing(payload: CreateListingPayload): Promise<CreateListingResult> {
  if (!(await hasPrivateKey())) {
    throw new Error('No stamper key configured. Import a private key in Settings before listing.');
  }
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  // Fetch the ordinal UTXO (the inscription we just minted) and pay UTXOs (for fees).
  const nftUtxos = await fetchNftUtxos(address);
  const ordinalUtxo = nftUtxos.find((u) => u.txid === payload.ordinalTxid && u.vout === payload.ordinalVout);
  if (!ordinalUtxo) {
    throw new Error(`Ordinal UTXO ${payload.ordinalTxid}_${payload.ordinalVout} not found at ${address}. Wait for confirmation, or transfer the ordinal to this address first.`);
  }

  const payUtxos = await fetchPayUtxos(address);
  if (!payUtxos.length) {
    throw new Error('No payment UTXOs — fund the wallet to cover listing fees.');
  }

  const result = await createOrdListings({
    utxos: payUtxos,
    listings: [{
      payAddress: payload.payAddress || address,
      ordAddress: address,            // address to return the ordinal to on cancel
      price: payload.priceSats,
      listingUtxo: ordinalUtxo
    }],
    paymentPk: privateKey,
    ordPk: privateKey,
    changeAddress: address,
    satsPerKb: 1
  });

  const txid = await broadcastViaWoC(result.tx.toHex());
  return {
    listingTxid: txid,
    listingVout: 0,                   // first output = listing UTXO
    priceSats: payload.priceSats
  };
}

// ── Cancel listing ──────────────────────────────────────────────────────

export type CancelListingPayload = {
  listingTxid: string;
  listingVout: number;
};

export async function cancelListing(payload: CancelListingPayload): Promise<{ txid: string }> {
  if (!(await hasPrivateKey())) {
    throw new Error('No stamper key configured.');
  }
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  const payUtxos = await fetchPayUtxos(address);
  if (!payUtxos.length) {
    throw new Error('No payment UTXOs — fund the wallet to cover cancel fees.');
  }

  // Build a Utxo-shape from the listing reference. js-1sat-ord's
  // cancelOrdListings expects the listing UTXO with its locking script;
  // we need to fetch the raw tx to extract it.
  const txRes = await fetch(`${WHATSONCHAIN_API}/tx/${payload.listingTxid}/hex`);
  if (!txRes.ok) throw new Error(`Listing tx fetch failed: ${txRes.status}`);
  const rawHex = (await txRes.text()).trim();
  const tx = Transaction.fromHex(rawHex);
  const out = tx.outputs[payload.listingVout];
  if (!out) throw new Error(`Listing vout ${payload.listingVout} not found in ${payload.listingTxid}`);

  const lockingScriptB64 = Buffer.from(out.lockingScript.toBinary()).toString('base64');
  const listingUtxo = {
    txid: payload.listingTxid,
    vout: payload.listingVout,
    satoshis: 1,                       // 1Sat ordinal listings are always 1 sat
    script: lockingScriptB64
  };

  const result = await cancelOrdListings({
    utxos: payUtxos,
    listingUtxos: [listingUtxo],
    paymentPk: privateKey,
    ordPk: privateKey,
    changeAddress: address,
    satsPerKb: 1
  });

  const txid = await broadcastViaWoC(result.tx.toHex());
  return { txid };
}

// ── Purchase listing ────────────────────────────────────────────────────

export type PurchaseListingPayload = {
  listingTxid: string;
  listingVout: number;
};

export async function purchaseListing(payload: PurchaseListingPayload): Promise<{ txid: string; ordinalId: string }> {
  if (!(await hasPrivateKey())) {
    throw new Error('No stamper key configured.');
  }
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  const payUtxos = await fetchPayUtxos(address);
  if (!payUtxos.length) {
    throw new Error('No payment UTXOs — fund the wallet to cover the purchase + fees.');
  }

  // Resolve the listing's UTXO + payout script from the listing tx.
  const txRes = await fetch(`${WHATSONCHAIN_API}/tx/${payload.listingTxid}/hex`);
  if (!txRes.ok) throw new Error(`Listing tx fetch failed: ${txRes.status}`);
  const rawHex = (await txRes.text()).trim();
  const tx = Transaction.fromHex(rawHex);
  const out = tx.outputs[payload.listingVout];
  if (!out) throw new Error(`Listing vout ${payload.listingVout} not found`);
  const listingScriptB64 = Buffer.from(out.lockingScript.toBinary()).toString('base64');

  // Look up the listing's payout/price via 1sat indexer.
  // The indexer exposes structured listing data; fall back to a
  // user-supplied price + payout if the lookup fails.
  let payoutB64: string | undefined;
  try {
    const lookup = await fetch(`${ONESAT_API}/api/listings/${payload.listingTxid}_${payload.listingVout}`);
    if (lookup.ok) {
      const data = await lookup.json() as { data?: { payout?: string } };
      payoutB64 = data?.data?.payout;
    }
  } catch { /* ignore — caller may provide payout via different path */ }
  if (!payoutB64) {
    throw new Error('Could not resolve listing payout from indexer. Try again in a moment, or pass the listing data manually.');
  }

  const result = await purchaseOrdListing({
    utxos: payUtxos,
    paymentPk: privateKey,
    listing: {
      payout: payoutB64,
      listingUtxo: {
        txid: payload.listingTxid,
        vout: payload.listingVout,
        satoshis: 1,
        script: listingScriptB64
      }
    },
    ordAddress: address,
    changeAddress: address,
    satsPerKb: 1
  });

  const txid = await broadcastViaWoC(result.tx.toHex());
  return { txid, ordinalId: `${txid}_0` };
}

// ── My listings (query) ─────────────────────────────────────────────────

export type MyListing = {
  listingTxid: string;
  listingVout: number;
  ordinalTxid: string;
  ordinalVout: number;
  priceSats: number;
  /** ISO timestamp of listing creation if known. */
  createdAt?: string;
  /** Best-effort title from MAP metadata. */
  title?: string;
};

export async function myListings(): Promise<MyListing[]> {
  if (!(await hasPrivateKey())) {
    throw new Error('No stamper key configured.');
  }
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  // 1sat indexer endpoint convention for listings by ord-receiving address.
  // Schema may vary by deployment; we surface what we can parse.
  const url = `${ONESAT_API}/api/market?address=${encodeURIComponent(String(address))}&active=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json() as Array<{
      txid?: string;
      vout?: number;
      origin?: { outpoint?: string; data?: { map?: { title?: string } } };
      data?: { list?: { price?: number }; map?: { title?: string } };
      height?: number;
      idx?: number;
    }>;
    if (!Array.isArray(json)) return [];
    return json.flatMap((row) => {
      const txid = row.txid;
      const vout = row.vout;
      if (!txid || vout == null) return [];
      const priceSats = row.data?.list?.price ?? 0;
      const originOutpoint = row.origin?.outpoint ?? '';
      const [ordinalTxid, ordinalVoutStr] = originOutpoint.split('_');
      return [{
        listingTxid: txid,
        listingVout: vout,
        ordinalTxid: ordinalTxid || txid,
        ordinalVout: Number(ordinalVoutStr ?? 0),
        priceSats,
        title: row.data?.map?.title || row.origin?.data?.map?.title
      }];
    });
  } catch {
    return [];
  }
}
