import { stampReceipts, mintDocuments, walletKeys } from './idb-store';
import {
  generateMasterKey,
  getMasterKeyInfo,
  deriveChildInfo,
  buildManifest,
  type DerivedChild,
  type MasterKeyInfo,
  type WalletManifest,
} from './wallet-derivation';

// --- Hashing ---

export async function hashFile(file: File): Promise<{ hash: string }> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return {
    hash: Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

// --- Stamp Receipts ---

export async function saveStampReceipt(json: string): Promise<void> {
  const receipt = JSON.parse(json);
  await stampReceipts.save(receipt);
}

export async function updateStampReceipt(id: string, patch: Record<string, unknown>): Promise<void> {
  await stampReceipts.update(id, patch);
}

export async function listStampReceipts(): Promise<Record<string, unknown>[]> {
  return stampReceipts.list();
}

// --- Mint Documents ---

export async function saveMintDocument(json: string): Promise<void> {
  const doc = JSON.parse(json);
  const id = doc.name ? doc.name.replace(/\s+/g, '-').toLowerCase() : crypto.randomUUID();
  await mintDocuments.save({
    id,
    name: doc.name || 'Untitled',
    data: json,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadMintDocument(id: string): Promise<string> {
  const doc = await mintDocuments.get(id);
  if (!doc) throw new Error('Document not found');
  return doc.data;
}

export async function listMintDocuments(): Promise<{ id: string; name: string; filePath: string; updatedAt: string }[]> {
  const docs = await mintDocuments.list();
  return docs.map((d) => ({
    id: d.id,
    name: d.name,
    filePath: d.id,
    updatedAt: d.updatedAt,
  }));
}

export async function deleteMintDocument(id: string): Promise<void> {
  await mintDocuments.delete(id);
}

// --- Export ---

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMintPng(opts: { dataUrl: string; defaultName: string }): string {
  const binary = atob(opts.dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  downloadBlob(blob, `${opts.defaultName}.png`);
  return opts.defaultName;
}

export function exportMintSvg(opts: { svgContent: string; defaultName: string }): void {
  const blob = new Blob([opts.svgContent], { type: 'image/svg+xml' });
  downloadBlob(blob, `${opts.defaultName}.svg`);
}

// --- Wallet / Keystore (encrypted in IndexedDB with SubtleCrypto AES-GCM) ---

async function deriveEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function keystoreHasMaster(): Promise<boolean> {
  return walletKeys.has();
}

export async function keystoreSetupMaster(): Promise<MasterKeyInfo> {
  const masterHex = generateMasterKey();
  // Encrypt with a random password-derived key (user sets password on export)
  // For storage, we use a random salt/IV and store the raw key encrypted
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Use a device-bound key (no password for local storage — password only for export)
  const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, new TextEncoder().encode(masterHex));
  // Store the device key as extractable for this session
  const exportedKey = await crypto.subtle.exportKey('raw', deviceKey);
  await walletKeys.set({
    type: 'master',
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...new Uint8Array(exportedKey))),
  });
  return getMasterKeyInfo(masterHex);
}

async function getDecryptedMasterKey(): Promise<string> {
  const stored = await walletKeys.get();
  if (!stored) throw new Error('No wallet found');
  const keyBytes = Uint8Array.from(atob(stored.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(stored.iv), c => c.charCodeAt(0));
  const encryptedData = Uint8Array.from(atob(stored.encryptedKey), c => c.charCodeAt(0));
  const deviceKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, deviceKey, encryptedData);
  return new TextDecoder().decode(decrypted);
}

export async function keystoreGetMasterInfo(): Promise<MasterKeyInfo> {
  const masterHex = await getDecryptedMasterKey();
  return getMasterKeyInfo(masterHex);
}

export async function keystoreDeriveAddress(protocol: string, slug: string): Promise<DerivedChild> {
  const masterHex = await getDecryptedMasterKey();
  return deriveChildInfo(masterHex, protocol, slug);
}

export async function keystoreExportBackup(password: string): Promise<string> {
  const masterHex = await getDecryptedMasterKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(masterHex));
  return JSON.stringify({
    v: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  });
}

export async function keystoreImportBackup(data: string, password: string): Promise<MasterKeyInfo> {
  const parsed = JSON.parse(data);
  const salt = Uint8Array.from(atob(parsed.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));
  const key = await deriveEncryptionKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  const masterHex = new TextDecoder().decode(decrypted);
  // Verify it's a valid key
  const info = getMasterKeyInfo(masterHex);
  // Re-encrypt for local storage
  const newIv = crypto.getRandomValues(new Uint8Array(12));
  const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const reEncrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: newIv }, deviceKey, new TextEncoder().encode(masterHex));
  const exportedKey = await crypto.subtle.exportKey('raw', deviceKey);
  await walletKeys.set({
    type: 'master',
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(reEncrypted))),
    iv: btoa(String.fromCharCode(...newIv)),
    salt: btoa(String.fromCharCode(...new Uint8Array(exportedKey))),
  });
  return info;
}

export async function keystoreBuildManifest(
  derivations: Array<{ protocol: string; slug: string }>
): Promise<WalletManifest> {
  const masterHex = await getDecryptedMasterKey();
  return buildManifest(masterHex, derivations);
}

export async function keystoreDeleteMaster(): Promise<void> {
  await walletKeys.delete();
}

// --- Helpers ---

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

async function fetchUtxosForAddress(address: string) {
  const res = await fetch(`${WHATSONCHAIN_API}/address/${address}/unspent`);
  if (!res.ok) throw new Error('Failed to fetch UTXOs');
  const utxos = await res.json();
  if (!utxos?.length) throw new Error(`No funds at ${address}. Send BSV to this address first.`);
  return utxos;
}

async function fetchSourceTx(txHash: string) {
  const sdk = await import('@bsv/sdk');
  const res = await fetch(`${WHATSONCHAIN_API}/tx/${txHash}/hex`);
  if (!res.ok) throw new Error('Failed to fetch source transaction');
  return sdk.Transaction.fromHex(await res.text());
}

// --- Inscription ---

export async function inscribeStamp(opts: {
  path: string;
  hash: string;
  timestamp: string;
}): Promise<{ txid: string }> {
  const masterHex = await getDecryptedMasterKey();
  const { deriveChildKey } = await import('./wallet-derivation');
  const childKey = await deriveChildKey(masterHex, 'stamp', opts.path);
  const address = childKey.toPublicKey().toAddress().toString();

  // Fetch UTXOs from WhatsOnChain
  const utxoRes = await fetch(
    `https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`
  );
  if (!utxoRes.ok) throw new Error('Failed to fetch UTXOs');
  const utxos = await utxoRes.json();
  if (!utxos || utxos.length === 0) {
    throw new Error(
      `No funds found for ${address}. Send BSV to this address to inscribe.`
    );
  }

  try {
    const sdk = await import('@bsv/sdk');
    const { Transaction, P2PKH, LockingScript } = sdk;

    const utxo = utxos[0];
    const fee = 500;

    // Fetch source transaction raw hex (needed for signing in @bsv/sdk v2)
    const rawTxRes = await fetch(
      `https://api.whatsonchain.com/v1/bsv/main/tx/${utxo.tx_hash}/hex`
    );
    if (!rawTxRes.ok) throw new Error('Failed to fetch source transaction');
    const rawTxHex = await rawTxRes.text();
    const sourceTx = Transaction.fromHex(rawTxHex);

    const tx = new Transaction();
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: utxo.tx_pos,
      unlockingScriptTemplate: new P2PKH().unlock(childKey),
    });

    // OP_RETURN: STAMP | path | sha256 | timestamp
    const opReturn = `STAMP | ${opts.path} | ${opts.hash} | ${opts.timestamp}`;
    const opReturnBytes = Array.from(new TextEncoder().encode(opReturn));
    const pushLen = opReturnBytes.length;
    const scriptHex = [0x00, 0x6a, pushLen, ...opReturnBytes]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    tx.addOutput({
      satoshis: 0,
      lockingScript: LockingScript.fromHex(scriptHex),
    });

    // Change output
    const changeSats = utxo.value - fee;
    if (changeSats > 546) {
      tx.addOutput({
        satoshis: changeSats,
        lockingScript: new P2PKH().lock(childKey.toPublicKey().toAddress()),
      });
    }

    await tx.sign();
    return broadcastTx(tx.toHex());
  } catch (e) {
    throw new Error(
      `Inscription failed: ${e instanceof Error ? e.message : e}`
    );
  }
}

// --- BSV-21 Token Minting (1Sat Ordinal inscription) ---

/**
 * Build a 1Sat Ordinal inscription locking script with BSV-21 token metadata.
 * Format: OP_FALSE OP_IF "ord" OP_1 <content-type> OP_0 <content> OP_ENDIF <P2PKH>
 */
async function buildOrdinalInscriptionScript(
  contentType: string,
  content: Uint8Array,
  address: any
) {
  const { Script, P2PKH, LockingScript } = await import('@bsv/sdk');
  const enc = new TextEncoder();

  const inscriptionScript = new Script();
  inscriptionScript.writeOpCode(0x00); // OP_FALSE
  inscriptionScript.writeOpCode(0x63); // OP_IF
  inscriptionScript.writeBin(Array.from(enc.encode('ord')));
  inscriptionScript.writeOpCode(0x51); // OP_1 (content type flag)
  inscriptionScript.writeBin(Array.from(enc.encode(contentType)));
  inscriptionScript.writeOpCode(0x00); // OP_0 (body flag)
  inscriptionScript.writeBin(Array.from(content));
  inscriptionScript.writeOpCode(0x68); // OP_ENDIF

  // Get P2PKH lock script and combine
  const p2pkhLock = new P2PKH().lock(address);
  return LockingScript.fromHex(inscriptionScript.toHex() + p2pkhLock.toHex());
}

/**
 * Mint a BSV-21 token as a 1Sat Ordinal inscription.
 * Creates a deploy+mint inscription on-chain with the token metadata.
 * Compatible with 1Sat Ordinals indexer and BRC-100 wallet interface.
 */
export async function mintStampToken(opts: {
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
}): Promise<{ tokenId: string }> {
  const masterHex = await getDecryptedMasterKey();
  const { deriveChildKey } = await import('./wallet-derivation');
  const childKey = await deriveChildKey(masterHex, 'token', opts.path);
  const pubKey = childKey.toPublicKey();
  const address = pubKey.toAddress();

  const utxos = await fetchUtxosForAddress(address.toString());
  const utxo = utxos[0];
  const sourceTx = await fetchSourceTx(utxo.tx_hash);

  const { Transaction, P2PKH } = await import('@bsv/sdk');

  // Build BSV-21 token metadata
  const symbol = opts.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'STAMP';
  const tokenMeta: Record<string, string> = {
    p: 'bsv-20',
    op: 'deploy+mint',
    sym: symbol,
    amt: '1',
    dec: '0',
  };

  const enc = new TextEncoder();
  const contentBytes = enc.encode(JSON.stringify(tokenMeta));
  const tokenLockingScript = await buildOrdinalInscriptionScript(
    'application/bsv-20',
    contentBytes,
    address
  );

  const tx = new Transaction();
  tx.addInput({
    sourceTransaction: sourceTx,
    sourceOutputIndex: utxo.tx_pos,
    unlockingScriptTemplate: new P2PKH().unlock(childKey),
  });

  // Output 0: Token inscription (1 satoshi — required by 1Sat Ordinals)
  tx.addOutput({ satoshis: 1, lockingScript: tokenLockingScript });

  // Change output
  const fee = 500;
  const changeSats = utxo.value - 1 - fee;
  if (changeSats > 546) {
    tx.addOutput({
      satoshis: changeSats,
      lockingScript: new P2PKH().lock(address),
    });
  } else if (changeSats < 0) {
    throw new Error('Insufficient sats for minting. Need at least 501 sats.');
  }

  await tx.sign();
  const result = await broadcastTx(tx.toHex());
  return { tokenId: `${result.txid}_0` };
}

/**
 * Batch mint BSV-21 tokens for multiple pieces (frames/segments).
 * Rate-limited at 200ms between mints.
 */
export async function batchMintTokens(pieces: Array<{
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
}>): Promise<void> {
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    try {
      await mintStampToken(piece);
    } catch (err) {
      console.error(`Batch mint failed at piece ${i}:`, err);
    }
    // Rate limit: 200ms between mints
    if (i < pieces.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

// --- Message Signing ---

export async function signMessage(message: string): Promise<{ signature: string; address: string }> {
  const masterHex = await getDecryptedMasterKey();
  const { deriveChildKey } = await import('./wallet-derivation');
  const childKey = await deriveChildKey(masterHex, 'sign', 'message');
  const address = childKey.toPublicKey().toAddress().toString();
  // Hash the message and sign with the private key
  const msgHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  const hashBytes = Array.from(new Uint8Array(msgHash));
  const sig = childKey.sign(hashBytes);
  return { signature: sig.toDER('hex') as string, address };
}

// --- Bit Trust Inscription ---

export async function inscribeBitTrust(opts: {
  contentHash: string;
  timestamp: string;
  tier: number;
  identityRef?: string;
}): Promise<{ txid: string }> {
  const masterHex = await getDecryptedMasterKey();
  const { deriveChildKey } = await import('./wallet-derivation');
  const childKey = await deriveChildKey(masterHex, 'bittrust', opts.contentHash.slice(0, 16));
  const address = childKey.toPublicKey().toAddress().toString();

  const utxos = await fetchUtxosForAddress(address);
  const utxo = utxos[0];
  const sourceTx = await fetchSourceTx(utxo.tx_hash);

  const { Transaction, P2PKH, LockingScript } = await import('@bsv/sdk');

  // Build OP_RETURN: BITTRUST | hash | signer | timestamp | TIER:N [| $401:ref]
  const parts = [
    'BITTRUST',
    opts.contentHash,
    address,
    opts.timestamp,
    `TIER:${opts.tier}`,
  ];
  if (opts.identityRef) parts.push(`$401:${opts.identityRef}`);
  const opReturn = parts.join(' | ');
  const opReturnBytes = Array.from(new TextEncoder().encode(opReturn));
  const pushLen = opReturnBytes.length;
  const scriptHex = [0x00, 0x6a, pushLen, ...opReturnBytes]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const tx = new Transaction();
  tx.addInput({
    sourceTransaction: sourceTx,
    sourceOutputIndex: utxo.tx_pos,
    unlockingScriptTemplate: new P2PKH().unlock(childKey),
  });

  tx.addOutput({
    satoshis: 0,
    lockingScript: LockingScript.fromHex(scriptHex),
  });

  const fee = 500;
  const changeSats = utxo.value - fee;
  if (changeSats > 546) {
    tx.addOutput({
      satoshis: changeSats,
      lockingScript: new P2PKH().lock(childKey.toPublicKey().toAddress()),
    });
  }

  await tx.sign();
  return broadcastTx(tx.toHex());
}

export async function signBitTrustMessage(message: string): Promise<{ signature: string; address: string }> {
  const masterHex = await getDecryptedMasterKey();
  const { deriveChildKey } = await import('./wallet-derivation');
  const childKey = await deriveChildKey(masterHex, 'bittrust', 'sign');
  const address = childKey.toPublicKey().toAddress().toString();
  const msgHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  const hashBytes = Array.from(new Uint8Array(msgHash));
  const sig = childKey.sign(hashBytes);
  return { signature: sig.toDER('hex') as string, address };
}

// --- Blockchain (broadcast relay) ---

export async function broadcastTx(rawHex: string): Promise<{ txid: string }> {
  const res = await fetch('/api/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawHex }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Broadcast failed' }));
    throw new Error(err.error || 'Broadcast failed');
  }
  return res.json();
}
