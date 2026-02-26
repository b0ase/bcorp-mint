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

export function generateMasterKey(): string {
  const key = PrivateKey.fromRandom();
  return key.toHex();
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveChildKey(masterKeyHex: string, protocol: string, slug: string): Promise<PrivateKey> {
  const childSeed = await hmacSha256(masterKeyHex, `${DERIVATION_PREFIX}:${protocol}/${slug}`);
  return PrivateKey.fromHex(childSeed.slice(0, 64));
}

export async function deriveChildInfo(masterKeyHex: string, protocol: string, slug: string): Promise<DerivedChild> {
  const childKey = await deriveChildKey(masterKeyHex, protocol, slug);
  const pubKey = childKey.toPublicKey();
  return {
    protocol,
    slug,
    address: pubKey.toAddress().toString(),
    publicKey: pubKey.toString(),
  };
}

export function getMasterKeyInfo(masterKeyHex: string): MasterKeyInfo {
  const masterKey = PrivateKey.fromHex(masterKeyHex);
  const pubKey = masterKey.toPublicKey();
  return {
    address: pubKey.toAddress().toString(),
    publicKey: pubKey.toString(),
  };
}

export async function buildManifest(
  masterKeyHex: string,
  children: Array<{ protocol: string; slug: string }>
): Promise<WalletManifest> {
  const masterKey = PrivateKey.fromHex(masterKeyHex);
  const masterPub = masterKey.toPublicKey();
  const derivedChildren = await Promise.all(
    children.map(({ protocol, slug }) => deriveChildInfo(masterKeyHex, protocol, slug))
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
