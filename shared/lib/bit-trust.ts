/**
 * Bit Trust — Blockchain-Native IP Registration System
 *
 * Implements the Bit Trust patent: hash → encrypt → inscribe → link identity.
 * Five trust tiers from self-signed (T1) to multi-party attestation (T5).
 *
 * Local-first: all data stored in IndexedDB. On-chain inscription is optional.
 * No cloud, no accounts, no telemetry — the chain is the only external record.
 */

// --- Types ---

export type TrustTier = 1 | 2 | 3 | 4 | 5;

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  1: 'Self-Signed',
  2: 'Co-Signed',
  3: 'Attorney Attested',
  4: 'Institutional',
  5: 'Multi-Party',
};

export const TRUST_TIER_COLORS: Record<TrustTier, string> = {
  1: '#6b7280', // zinc
  2: '#3b82f6', // blue
  3: '#8b5cf6', // purple
  4: '#f59e0b', // amber
  5: '#10b981', // emerald
};

export type IPRegistrationStatus = 'draft' | 'hashed' | 'encrypted' | 'inscribed' | 'failed';

export interface CoSigner {
  address: string;
  name: string;
  signature: string;
  timestamp: string;
}

export interface BitTrustRegistration {
  id: string;
  /** Display name for the IP asset */
  name: string;
  /** Original filename */
  fileName: string;
  /** File MIME type */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** SHA-256 hash of the original file */
  contentHash: string;
  /** Trust tier (1-5) */
  tier: TrustTier;
  /** Registration status */
  status: IPRegistrationStatus;
  /** ISO timestamp of registration */
  registeredAt: string;
  /** Wallet address that signed the registration */
  signerAddress: string | null;
  /** Wallet signature over the registration message */
  signature: string | null;
  /** The deterministic message that was signed */
  signedMessage: string | null;
  /** On-chain TXID (if inscribed) */
  txid: string | null;
  /** $401 identity reference (if linked) */
  identityRef: string | null;
  /** Co-signers for Tier 2+ */
  coSigners: CoSigner[];
  /** AES-256-GCM encrypted content (base64) — stored locally */
  encryptedContent: string | null;
  /** Encryption IV (hex) */
  iv: string | null;
  /** Encryption envelope key (hex) — only in local storage */
  envelopeKey: string | null;
  /** Optional description / notes */
  description: string;
  /** Tags for categorization */
  tags: string[];
}

// --- Inscription Format ---

/**
 * Build the on-chain inscription message for a Bit Trust registration.
 * Format: BITTRUST | hash | signer | timestamp | TIER:N
 * Optional: | $401:identity-ref | COSIGNERS:N
 */
export function buildInscriptionMessage(reg: BitTrustRegistration): string {
  const parts = [
    'BITTRUST',
    reg.contentHash,
    reg.signerAddress || 'UNSIGNED',
    reg.registeredAt,
    `TIER:${reg.tier}`,
  ];
  if (reg.identityRef) parts.push(`$401:${reg.identityRef}`);
  if (reg.coSigners.length > 0) parts.push(`COSIGNERS:${reg.coSigners.length}`);
  return parts.join(' | ');
}

/**
 * Build the deterministic message to be signed by the registrant's wallet.
 */
export function buildRegistrationSignMessage(contentHash: string, timestamp: string): string {
  return `BITTRUST|REGISTER|${contentHash}|AT:${timestamp}`;
}

/**
 * Build the deterministic message to be signed by a co-signer.
 */
export function buildCoSignMessage(contentHash: string, signerAddress: string, timestamp: string): string {
  return `BITTRUST|COSIGN|${contentHash}|BY:${signerAddress}|AT:${timestamp}`;
}

// --- IndexedDB Storage ---

const DB_NAME = 'bit-trust';
const DB_VERSION = 1;
const STORE_NAME = 'registrations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('registeredAt', 'registeredAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('contentHash', 'contentHash', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRegistration(reg: BitTrustRegistration): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(reg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRegistration(id: string): Promise<BitTrustRegistration | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listRegistrations(): Promise<BitTrustRegistration[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = req.result as BitTrustRegistration[];
      items.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateRegistration(id: string, patch: Partial<BitTrustRegistration>): Promise<void> {
  const existing = await getRegistration(id);
  if (!existing) throw new Error(`Registration ${id} not found`);
  await saveRegistration({ ...existing, ...patch });
}

export async function deleteRegistration(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Hashing ---

export async function hashFileContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Encryption (AES-256-GCM) ---

export async function encryptContent(data: ArrayBuffer): Promise<{
  ciphertext: string;
  iv: string;
  envelopeKey: string;
}> {
  const envelopeKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource },
    aesKey,
    data
  );

  // Convert to storable formats
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const iv = Array.from(ivBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const envelopeKey = Array.from(envelopeKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return { ciphertext, iv, envelopeKey };
}

export async function decryptContent(
  ciphertextB64: string,
  ivHex: string,
  envelopeKeyHex: string
): Promise<ArrayBuffer> {
  const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const keyBytes = new Uint8Array(envelopeKeyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    ciphertext as unknown as BufferSource
  );
}

// --- Full Registration Flow ---

/**
 * Register a file as intellectual property in the Bit Trust vault.
 * Steps: hash → encrypt → store locally → return registration.
 * On-chain inscription is a separate step (user-initiated).
 */
export async function registerIP(file: File, opts?: {
  name?: string;
  description?: string;
  tags?: string[];
  encrypt?: boolean;
}): Promise<BitTrustRegistration> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // 1. Hash the file
  const contentHash = await hashFileContent(file);

  // 2. Optionally encrypt
  let encryptedContent: string | null = null;
  let iv: string | null = null;
  let envelopeKey: string | null = null;

  if (opts?.encrypt !== false) {
    const buffer = await file.arrayBuffer();
    const encrypted = await encryptContent(buffer);
    encryptedContent = encrypted.ciphertext;
    iv = encrypted.iv;
    envelopeKey = encrypted.envelopeKey;
  }

  // 3. Build registration
  const reg: BitTrustRegistration = {
    id,
    name: opts?.name || file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    contentHash,
    tier: 1, // Self-signed by default
    status: encryptedContent ? 'encrypted' : 'hashed',
    registeredAt: timestamp,
    signerAddress: null,
    signature: null,
    signedMessage: null,
    txid: null,
    identityRef: null,
    coSigners: [],
    encryptedContent,
    iv,
    envelopeKey,
    description: opts?.description || '',
    tags: opts?.tags || [],
  };

  // 4. Store locally
  await saveRegistration(reg);

  return reg;
}

/**
 * Sign a registration with the user's wallet key.
 * Upgrades status and records the signature.
 */
export async function signRegistration(
  id: string,
  signer: { address: string; sign: (message: string) => Promise<string> }
): Promise<BitTrustRegistration> {
  const reg = await getRegistration(id);
  if (!reg) throw new Error('Registration not found');

  const message = buildRegistrationSignMessage(reg.contentHash, reg.registeredAt);
  const signature = await signer.sign(message);

  const updated: BitTrustRegistration = {
    ...reg,
    signerAddress: signer.address,
    signature,
    signedMessage: message,
    status: reg.status === 'inscribed' ? 'inscribed' : 'encrypted',
  };

  await saveRegistration(updated);
  return updated;
}

// --- Export / Verification ---

/**
 * Build a verification receipt (shareable proof without the encrypted content).
 */
export function buildVerificationReceipt(reg: BitTrustRegistration): Record<string, unknown> {
  return {
    protocol: 'BITTRUST',
    version: 1,
    id: reg.id,
    name: reg.name,
    contentHash: reg.contentHash,
    tier: reg.tier,
    tierLabel: TRUST_TIER_LABELS[reg.tier],
    registeredAt: reg.registeredAt,
    signerAddress: reg.signerAddress,
    signature: reg.signature,
    signedMessage: reg.signedMessage,
    txid: reg.txid,
    identityRef: reg.identityRef,
    coSigners: reg.coSigners.map(cs => ({
      address: cs.address,
      name: cs.name,
      timestamp: cs.timestamp,
    })),
  };
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
