/**
 * End-to-End Encryption Library for Bitcoin Mint
 *
 * Uses Web Crypto API (SubtleCrypto) — no external dependencies.
 * Architecture: One encrypted document, multiple key wrappings per recipient.
 * The server never sees plaintext after encryption.
 */

import { bufferToBase64, base64ToBuffer } from './attestation';

// Re-export helpers so consumers only need one import
export { bufferToBase64, base64ToBuffer };

// --- Key Generation ---

/**
 * Generate an ECDH P-256 keypair for E2E encryption.
 */
export async function generateKeyPair(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}

// --- Key Import / Export ---

export function exportPublicKey(jwk: JsonWebKey): string {
  return btoa(JSON.stringify(jwk));
}

export async function importPublicKey(base64Jwk: string): Promise<CryptoKey> {
  const jwk: JsonWebKey = JSON.parse(atob(base64Jwk));
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// --- Document Encryption (Envelope Key) ---

export async function encryptDocument(plaintext: ArrayBuffer): Promise<{
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  envelopeKey: Uint8Array;
}> {
  const envelopeKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    plaintext
  );

  return { ciphertext, iv, envelopeKey };
}

export async function decryptDocument(
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  envelopeKey: Uint8Array
): Promise<ArrayBuffer> {
  const aesKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    ciphertext
  );
}

// --- Key Wrapping (ECDH + HKDF + AES-KW) ---

const HKDF_INFO = new TextEncoder().encode('bit-sign-e2e-v2');
const HKDF_SALT = new Uint8Array(32);

async function deriveWrappingKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export async function wrapKeyForRecipient(
  envelopeKey: Uint8Array,
  senderPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<{
  wrappedKey: ArrayBuffer;
  senderPublicKey: JsonWebKey;
}> {
  const wrappingKey = await deriveWrappingKey(senderPrivateKey, recipientPublicKey);

  const envelopeCryptoKey = await crypto.subtle.importKey(
    'raw',
    envelopeKey.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    envelopeCryptoKey,
    wrappingKey,
    'AES-KW'
  );

  const senderPublicKey = await crypto.subtle.exportKey(
    'jwk',
    await getPublicKeyFromPrivate(senderPrivateKey)
  );

  return { wrappedKey, senderPublicKey };
}

export async function unwrapKey(
  wrappedKey: ArrayBuffer,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<Uint8Array> {
  const wrappingKey = await deriveWrappingKey(recipientPrivateKey, senderPublicKey);

  const unwrapped = await crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const raw = await crypto.subtle.exportKey('raw', unwrapped);
  return new Uint8Array(raw);
}

// --- Private Key Protection ---

export async function deriveProtectionKey(
  handcashSignature: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const signatureBytes = encoder.encode(handcashSignature);
  const hashBuffer = await crypto.subtle.digest('SHA-256', signatureBytes);

  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(
  privateKey: JsonWebKey,
  protectionKey: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(privateKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    protectionKey,
    data
  );

  return { encrypted, iv };
}

export async function decryptPrivateKey(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  protectionKey: CryptoKey
): Promise<JsonWebKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    protectionKey,
    encrypted
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

// --- Helpers ---

async function getPublicKeyFromPrivate(privateKey: CryptoKey): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const { d: _, ...publicJwk } = jwk;
  return await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}
