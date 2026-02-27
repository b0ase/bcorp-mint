/**
 * Mint Vault — Local encrypted design storage using IndexedDB.
 *
 * Stores currency designs locally with encryption metadata.
 * Supports upload to UHRP (on-chain) for permanent storage.
 */

const DB_NAME = 'mint-vault';
const DB_VERSION = 1;
const STORE_NAME = 'vault-entries';

export type VaultEntryStatus = 'local' | 'uploading' | 'on-chain';

export interface VaultEntry {
  id: string;
  name: string;
  thumbnail: string;        // data URL (PNG)
  createdAt: string;         // ISO date
  status: VaultEntryStatus;
  uhrpUrl?: string;
  publicUrl?: string;
  txid?: string;
  iv: string;                // hex-encoded IV
  wrappedKey: string;        // hex-encoded envelope key
  docJson?: string;          // MintDocument JSON for re-editing
  fileSize: number;          // bytes of encrypted payload
}

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export { hexFromBytes, bytesFromHex };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveToVault(entry: VaultEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listVaultEntries(): Promise<VaultEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('createdAt').getAll();
    req.onsuccess = () => {
      const entries = req.result as VaultEntry[];
      // Sort newest first
      entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getVaultEntry(id: string): Promise<VaultEntry | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateVaultEntry(id: string, patch: Partial<VaultEntry>): Promise<void> {
  const existing = await getVaultEntry(id);
  if (!existing) throw new Error(`Vault entry ${id} not found`);
  await saveToVault({ ...existing, ...patch });
}

export async function deleteVaultEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Encrypt a document payload for vault storage.
 * Uses AES-256-GCM with a random envelope key.
 */
export async function encryptForVault(plaintext: string): Promise<{
  ciphertext: Uint8Array;
  iv: Uint8Array;
  envelopeKey: Uint8Array;
}> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const envelopeKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    data
  );

  return { ciphertext: new Uint8Array(encrypted), iv, envelopeKey };
}

/**
 * Decrypt a vault-stored payload.
 */
export async function decryptFromVault(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  envelopeKey: Uint8Array
): Promise<string> {
  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    ciphertext as unknown as BufferSource
  );

  return new TextDecoder().decode(decrypted);
}
