import { createHmac, randomBytes } from 'node:crypto';
import { PrivateKey } from '@bsv/sdk';

const DERIVATION_PREFIX = 'bcorp-mint-wallets';

export interface DerivedChild {
  protocol: string;
  slug: string;
  address: string;
  publicKey: string;
}

export interface MasterKeyInfo {
  address: string;
  publicKey: string;
}

export interface WalletManifest {
  version: 1;
  protocol: typeof DERIVATION_PREFIX;
  masterAddress: string;
  masterPublicKey: string;
  children: DerivedChild[];
  exportedAt: string;
}

/**
 * Generate a new random master private key (256-bit).
 * Returns hex string suitable for storage in safeStorage.
 */
export function generateMasterKey(): string {
  const key = PrivateKey.fromRandom();
  return key.toHex();
}

/**
 * Derive a deterministic child private key from master + protocol + slug.
 *
 * Formula: childSeed = HMAC-SHA256(masterKeyHex, "bcorp-mint-wallets:" + protocol + "/" + slug)
 *          childKey  = PrivateKey.fromHex(childSeed.slice(0, 64))
 */
export function deriveChildKey(masterKeyHex: string, protocol: string, slug: string): PrivateKey {
  const childSeed = createHmac('sha256', masterKeyHex)
    .update(`${DERIVATION_PREFIX}:${protocol}/${slug}`)
    .digest('hex');
  return PrivateKey.fromHex(childSeed.slice(0, 64));
}

/**
 * Derive child address info without exposing the private key.
 */
export function deriveChildInfo(masterKeyHex: string, protocol: string, slug: string): DerivedChild {
  const childKey = deriveChildKey(masterKeyHex, protocol, slug);
  const pubKey = childKey.toPublicKey();
  return {
    protocol,
    slug,
    address: pubKey.toAddress().toString(),
    publicKey: pubKey.toString(),
  };
}

/**
 * Get master key info (address + public key) without exposing private key.
 */
export function getMasterKeyInfo(masterKeyHex: string): MasterKeyInfo {
  const masterKey = PrivateKey.fromHex(masterKeyHex);
  const pubKey = masterKey.toPublicKey();
  return {
    address: pubKey.toAddress().toString(),
    publicKey: pubKey.toString(),
  };
}

/**
 * Build a full wallet manifest for export/backup.
 */
export function buildManifest(
  masterKeyHex: string,
  children: Array<{ protocol: string; slug: string }>
): WalletManifest {
  const masterKey = PrivateKey.fromHex(masterKeyHex);
  const masterPub = masterKey.toPublicKey();

  const derivedChildren = children.map(({ protocol, slug }) =>
    deriveChildInfo(masterKeyHex, protocol, slug)
  );

  return {
    version: 1,
    protocol: DERIVATION_PREFIX,
    masterAddress: masterPub.toAddress().toString(),
    masterPublicKey: masterPub.toString(),
    children: derivedChildren,
    exportedAt: new Date().toISOString(),
  };
}
