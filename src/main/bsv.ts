import { PrivateKey, Transaction, P2PKH, Script } from '@bsv/sdk';
import { loadPrivateKey, loadMasterKey, hasMasterKey } from './keystore';
import { deriveChildKey } from './wallet-derivation';
import { inscribeHashesViaHandCash } from './handcash-pay';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

type Utxo = { tx_hash: string; tx_pos: number; value: number };

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const res = await fetch(`${WHATSONCHAIN_API}/address/${address}/unspent`);
  if (!res.ok) throw new Error(`Failed to fetch UTXOs: ${res.statusText}`);
  return res.json() as Promise<Utxo[]>;
}

export async function broadcastTx(rawHex: string): Promise<string> {
  const res = await fetch(`${WHATSONCHAIN_API}/tx/raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txhex: rawHex })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Broadcast failed: ${err}`);
  }
  const txid = await res.text();
  return txid.replace(/"/g, '');
}

/**
 * Resolve the signing private key for a given derivation context.
 * If master key exists and derivation params provided, derives a child key.
 * Otherwise falls back to the legacy single WIF.
 */
async function resolveSigningKey(derivation?: { protocol: string; slug: string }): Promise<PrivateKey> {
  if (derivation && await hasMasterKey()) {
    const masterHex = await loadMasterKey();
    return deriveChildKey(masterHex, derivation.protocol, derivation.slug);
  }
  // Legacy fallback: load single WIF
  const wif = await loadPrivateKey();
  return PrivateKey.fromWif(wif);
}

/**
 * Inscribe a stamp on BSV via OP_RETURN.
 * Format: OP_RETURN | STAMP | <path> | <sha256> | <iso-timestamp>
 *
 * Private key is resolved internally — never crosses IPC.
 * If derivation params provided and master key exists, uses derived child key.
 */
export async function inscribeStamp(payload: {
  path: string;
  hash: string;
  timestamp: string;
  parentHash?: string;
  pieceIndex?: number;
  totalPieces?: number;
  derivation?: { protocol: string; slug: string };
}): Promise<{ txid: string }> {
  const privateKey = await resolveSigningKey(payload.derivation);
  const address = privateKey.toPublicKey().toAddress();

  const utxos = await fetchUtxos(address);
  if (utxos.length === 0) {
    throw new Error('No UTXOs found. Please fund your stamper wallet.');
  }

  const tx = new Transaction();
  const utxo = utxos[0];

  tx.addInput({
    sourceTXID: utxo.tx_hash,
    sourceOutputIndex: utxo.tx_pos,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey)
  });

  // Build OP_RETURN: STAMP | path | hash | timestamp [| PARENT:hash | INDEX:n | TOTAL:n]
  const opReturn = new Script();
  opReturn.writeOpCode(106); // OP_RETURN
  opReturn.writeBin(Array.from(Buffer.from('STAMP', 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(payload.path, 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(payload.hash, 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(payload.timestamp, 'utf8')));

  // Extended metadata for tokenised pieces
  if (payload.parentHash) {
    opReturn.writeBin(Array.from(Buffer.from(`PARENT:${payload.parentHash}`, 'utf8')));
  }
  if (payload.pieceIndex !== undefined) {
    opReturn.writeBin(Array.from(Buffer.from(`INDEX:${payload.pieceIndex}`, 'utf8')));
  }
  if (payload.totalPieces !== undefined) {
    opReturn.writeBin(Array.from(Buffer.from(`TOTAL:${payload.totalPieces}`, 'utf8')));
  }

  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });

  // Change
  const minerFee = 500;
  const change = utxo.value - minerFee;
  if (change < 0) throw new Error('Insufficient satoshis for miner fee');
  if (change > 0) {
    tx.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: change });
  }

  await tx.sign();
  const txid = await broadcastTx(tx.toHex());
  return { txid };
}

/**
 * Inscribe document hashes on BSV.
 *
 * Routes to HandCash Pay API or local wallet depending on the provider param.
 * OP_RETURN format: BCORP_IP_HASH | ts:<iso> | <file>:<sha256> | ...
 */
export async function inscribeDocumentHash(payload: {
  hashes: Array<{ file: string; sha256: string }>;
  provider: 'local' | 'handcash';
  derivation?: { protocol: string; slug: string };
}): Promise<{ txid: string }> {
  if (payload.provider === 'handcash') {
    return inscribeHashesViaHandCash(payload.hashes);
  }

  // Local wallet signing
  const privateKey = await resolveSigningKey(payload.derivation);
  const address = privateKey.toPublicKey().toAddress();

  const utxos = await fetchUtxos(address);
  if (utxos.length === 0) {
    throw new Error('No UTXOs found. Please fund your stamper wallet.');
  }

  const tx = new Transaction();
  const utxo = utxos[0];

  tx.addInput({
    sourceTXID: utxo.tx_hash,
    sourceOutputIndex: utxo.tx_pos,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey)
  });

  const timestamp = new Date().toISOString();
  const opReturn = new Script();
  opReturn.writeOpCode(106); // OP_RETURN
  opReturn.writeBin(Array.from(Buffer.from('BCORP_IP_HASH', 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(`ts:${timestamp}`, 'utf8')));

  for (const h of payload.hashes) {
    opReturn.writeBin(Array.from(Buffer.from(`${h.file}:${h.sha256}`, 'utf8')));
  }

  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });

  const minerFee = 500;
  const change = utxo.value - minerFee;
  if (change < 0) throw new Error('Insufficient satoshis for miner fee');
  if (change > 0) {
    tx.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: change });
  }

  await tx.sign();
  const txid = await broadcastTx(tx.toHex());
  return { txid };
}
