/**
 * Cloud Vault — Encrypted cloud storage for Mint designs.
 *
 * Flow: Hash document -> Sign with wallet -> Derive AES key from signature
 *       -> Encrypt -> Upload to server -> Store encrypted bundle
 *
 * Decryption: Re-sign same hash -> Derive same key -> Decrypt
 *
 * No plaintext ever leaves the device. Server stores only encrypted bundles.
 */

import type { AttestationProof, EncryptedBundle } from './types';

const CLOUD_VAULT_SEED = 'MINT_CLOUD_VAULT_KEY_SEED';

/**
 * SHA-256 hash a string and return hex.
 */
export async function hashString(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive an AES-256-GCM key from a wallet signature.
 * Uses the same pattern as the existing attestation.ts.
 */
async function deriveKeyFromSignature(signature: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(signature));
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
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

/**
 * Build the attestation message that the wallet signs.
 */
export function buildAttestationMessage(docHash: string): string {
  return `${CLOUD_VAULT_SEED}|ATTEST|${docHash}`;
}

/**
 * Attest and encrypt a document for cloud storage.
 *
 * @param docJson - The MintDocument JSON string
 * @param signMessage - Platform's signMessage function
 * @returns Encrypted bundle ready for upload
 */
export async function attestAndEncrypt(
  docJson: string,
  name: string,
  assetType: string,
  signMessage: (message: string) => Promise<{ signature: string; address: string }>,
): Promise<{ bundle: EncryptedBundle; attestation: AttestationProof }> {
  // 1. Hash the document
  const docHash = await hashString(docJson);

  // 2. Sign the attestation message
  const message = buildAttestationMessage(docHash);
  const { signature, address } = await signMessage(message);

  const attestation: AttestationProof = {
    hash: docHash,
    signature,
    address,
    timestamp: new Date().toISOString(),
    walletType: 'local',
  };

  // 3. Derive AES key from signature
  const aesKey = await deriveKeyFromSignature(signature);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 4. Encrypt document
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    encoder.encode(docJson),
  );

  const bundle: EncryptedBundle = {
    ciphertext: bufferToBase64(encrypted),
    iv: hexFromBytes(iv),
    attestation,
    assetType,
    name,
  };

  return { bundle, attestation };
}

/**
 * Decrypt a cloud vault bundle using the wallet signature.
 */
export async function decryptBundle(
  bundle: EncryptedBundle,
  signMessage: (message: string) => Promise<{ signature: string; address: string }>,
): Promise<string> {
  // Re-sign the same attestation message to derive the same key
  const message = buildAttestationMessage(bundle.attestation.hash);
  const { signature } = await signMessage(message);

  const aesKey = await deriveKeyFromSignature(signature);
  const iv = bytesFromHex(bundle.iv);
  const ciphertext = base64ToBuffer(bundle.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Upload encrypted bundle to cloud API.
 */
export async function uploadToCloud(
  bundle: EncryptedBundle,
  apiBase: string = '',
): Promise<{ cloudId: string }> {
  const res = await fetch(`${apiBase}/api/mint-vault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bundle),
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud save failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { cloudId: data.id };
}

/**
 * List cloud vault entries.
 */
export async function listCloudEntries(
  apiBase: string = '',
): Promise<Array<{ id: string; name: string; assetType: string; createdAt: string }>> {
  const res = await fetch(`${apiBase}/api/mint-vault`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud list failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Download a cloud vault entry by ID.
 */
export async function downloadFromCloud(
  cloudId: string,
  apiBase: string = '',
): Promise<EncryptedBundle> {
  const res = await fetch(`${apiBase}/api/mint-vault/${cloudId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud download failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Delete a cloud vault entry.
 */
export async function deleteFromCloud(
  cloudId: string,
  apiBase: string = '',
): Promise<void> {
  const res = await fetch(`${apiBase}/api/mint-vault/${cloudId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud delete failed (${res.status}): ${text}`);
  }
}

/**
 * Export an encrypted bundle as a downloadable .mint file.
 */
export function exportBundleFile(bundle: EncryptedBundle): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bundle.name || 'mint-design'}-${Date.now()}.mint`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import a .mint bundle file and return its contents.
 */
export function importBundleFile(): Promise<EncryptedBundle> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mint,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      try {
        const text = await file.text();
        const bundle = JSON.parse(text) as EncryptedBundle;
        if (!bundle.ciphertext || !bundle.iv || !bundle.attestation) {
          throw new Error('Invalid .mint file format');
        }
        resolve(bundle);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse .mint file'));
      }
    };
    input.click();
  });
}
