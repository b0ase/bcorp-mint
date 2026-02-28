import { PrivateKey, Transaction, P2PKH, Script } from '@bsv/sdk';
import { loadPrivateKey, loadMasterKey, hasMasterKey } from './keystore';
import { deriveChildKey } from './wallet-derivation';
import { inscribeHashesViaHandCash, inscribeBitTrustViaHandCash } from './handcash-pay';
import { getTreasuryAddress, MINT_FEE_SATS } from './treasury';
import type { WalletProvider } from './wallet-provider';

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

/** Helper: build a local-signed tx with OP_RETURN + treasury fee + change */
async function buildAndBroadcastOpReturn(
  privateKey: PrivateKey,
  opReturn: Script,
): Promise<string> {
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

  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });

  // Treasury fee — resolve paymail, skip if resolution fails
  let treasuryFee = 0;
  try {
    const treasuryAddr = await getTreasuryAddress();
    tx.addOutput({ lockingScript: new P2PKH().lock(treasuryAddr), satoshis: MINT_FEE_SATS });
    treasuryFee = MINT_FEE_SATS;
  } catch {
    // Don't block the user's inscription if treasury resolution fails
  }

  const minerFee = 500;
  const change = utxo.value - minerFee - treasuryFee;
  if (change < 0) throw new Error('Insufficient satoshis for miner fee');
  if (change > 0) {
    tx.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: change });
  }

  await tx.sign();
  return broadcastTx(tx.toHex());
}

/**
 * Build an OP_RETURN locking script from data fields and return as hex string.
 * Used by BRC-100 routing to pass scripts to createAction().
 */
export function buildOpReturnScriptHex(dataFields: (string | Buffer)[]): string {
  const script = new Script();
  script.writeOpCode(0);   // OP_FALSE
  script.writeOpCode(106); // OP_RETURN
  for (const field of dataFields) {
    const buf = typeof field === 'string' ? Buffer.from(field, 'utf8') : field;
    script.writeBin(Array.from(buf));
  }
  return script.toHex();
}

/**
 * Route an OP_RETURN inscription through the appropriate wallet provider.
 * - Local wallet: uses existing buildAndBroadcastOpReturn with resolveSigningKey
 * - BRC-100 wallet (MetaNet): converts data fields to lockingScript, calls createAction()
 */
export async function routeOpReturnInscription(
  dataFields: (string | Buffer)[],
  opts: {
    provider?: WalletProvider;
    description?: string;
    labels?: string[];
    derivation?: { protocol: string; slug: string };
  } = {},
): Promise<{ txid: string }> {
  const { provider, description, labels, derivation } = opts;

  // BRC-100 route: provider has createAction
  if (provider && provider.supportsCreateAction && provider.createAction) {
    const lockingScript = buildOpReturnScriptHex(dataFields);
    const result = await provider.createAction({
      description: description || 'Mint inscription',
      outputs: [{ lockingScript, satoshis: 1 }],
      labels: labels || ['mint', 'inscription'],
    });
    return { txid: result.txid };
  }

  // Local wallet route (default)
  const privateKey = await resolveSigningKey(derivation);
  const opReturn = new Script();
  opReturn.writeOpCode(106); // OP_RETURN
  for (const field of dataFields) {
    const buf = typeof field === 'string' ? Buffer.from(field, 'utf8') : field;
    opReturn.writeBin(Array.from(buf));
  }
  const txid = await buildAndBroadcastOpReturn(privateKey, opReturn);
  return { txid };
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
  provider?: WalletProvider;
}): Promise<{ txid: string }> {
  // Build data fields for OP_RETURN
  const dataFields: string[] = [
    'STAMP',
    payload.path,
    payload.hash,
    payload.timestamp,
  ];

  if (payload.parentHash) dataFields.push(`PARENT:${payload.parentHash}`);
  if (payload.pieceIndex !== undefined) dataFields.push(`INDEX:${payload.pieceIndex}`);
  if (payload.totalPieces !== undefined) dataFields.push(`TOTAL:${payload.totalPieces}`);

  return routeOpReturnInscription(dataFields, {
    provider: payload.provider,
    description: `Stamp inscription: ${payload.path}`,
    labels: ['mint', 'stamp'],
    derivation: payload.derivation,
  });
}

/**
 * Inscribe document hashes on BSV.
 *
 * Routes to HandCash Pay API or local wallet depending on the provider param.
 * OP_RETURN format: BCORP_IP_HASH | ts:<iso> | <file>:<sha256> | ...
 */
export async function inscribeDocumentHash(payload: {
  hashes: Array<{ file: string; sha256: string }>;
  provider: 'local' | 'handcash' | 'metanet';
  walletProvider?: WalletProvider;
  derivation?: { protocol: string; slug: string };
}): Promise<{ txid: string }> {
  if (payload.provider === 'handcash') {
    return inscribeHashesViaHandCash(payload.hashes);
  }

  const timestamp = new Date().toISOString();
  const dataFields: string[] = [
    'BCORP_IP_HASH',
    `ts:${timestamp}`,
    ...payload.hashes.map((h) => `${h.file}:${h.sha256}`),
  ];

  return routeOpReturnInscription(dataFields, {
    provider: payload.walletProvider,
    description: `Document hash inscription (${payload.hashes.length} file${payload.hashes.length > 1 ? 's' : ''})`,
    labels: ['mint', 'document-hash'],
    derivation: payload.derivation,
  });
}

/**
 * Inscribe a Bit Trust IP registration on BSV.
 *
 * OP_RETURN format: BITTRUST | hash | signer | timestamp | TIER:N [| FILING:ref] [| $401:identity]
 *
 * Routes to HandCash or local wallet depending on provider.
 * Each document gets its own transaction — call once per registration.
 */
export async function inscribeBitTrust(payload: {
  contentHash: string;
  tier: number;
  title: string;
  filing?: string;
  identityRef?: string;
  provider: 'local' | 'handcash' | 'metanet';
  walletProvider?: WalletProvider;
  derivation?: { protocol: string; slug: string };
}): Promise<{ txid: string }> {
  const timestamp = new Date().toISOString();

  if (payload.provider === 'handcash') {
    return inscribeBitTrustViaHandCash({
      contentHash: payload.contentHash,
      tier: payload.tier,
      title: payload.title,
      filing: payload.filing,
      identityRef: payload.identityRef,
      timestamp,
    });
  }

  // For MetaNet provider, get address from wallet; for local, resolve signing key
  let signerAddress: string;
  if (payload.walletProvider && payload.walletProvider.supportsCreateAction) {
    signerAddress = await payload.walletProvider.getAddress();
  } else {
    const privateKey = await resolveSigningKey(payload.derivation);
    signerAddress = privateKey.toPublicKey().toAddress().toString();
  }

  const dataFields: string[] = [
    'BITTRUST',
    payload.contentHash,
    signerAddress,
    timestamp,
    `TIER:${payload.tier}`,
  ];

  if (payload.filing) dataFields.push(`FILING:${payload.filing}`);
  if (payload.identityRef) dataFields.push(`$401:${payload.identityRef}`);

  return routeOpReturnInscription(dataFields, {
    provider: payload.walletProvider,
    description: `Bit Trust registration: ${payload.title}`,
    labels: ['mint', 'bittrust'],
    derivation: payload.derivation,
  });
}
