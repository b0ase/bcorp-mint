/**
 * MetaNet Desktop BRC-100 Wallet Provider (Browser)
 *
 * Connects to MetaNet Desktop running on localhost:3321.
 * Uses @bsv/sdk WalletClient + HTTPWalletJSON transport.
 * Supports createAction() for BRC-100 compliant operations.
 */

import type {
  WalletProvider,
  WalletProviderStatus,
  CreateActionArgs,
  CreateActionResult,
} from './wallet-provider';

let walletClientModule: typeof import('@bsv/sdk') | null = null;

async function getSDK() {
  if (!walletClientModule) {
    walletClientModule = await import('@bsv/sdk');
  }
  return walletClientModule;
}

export class MetaNetWalletProvider implements WalletProvider {
  type = 'metanet' as const;
  supportsCreateAction = true;
  private connected = false;
  private walletClient: any = null;

  async connect(): Promise<void> {
    const sdk = await getSDK();
    const substrate = new sdk.HTTPWalletJSON('http://127.0.0.1:3321');
    this.walletClient = new sdk.WalletClient(substrate);
    // Verify connection with a lightweight call
    try {
      await this.walletClient.getPublicKey({
        protocolID: [1, 'mint-address'],
        keyID: '1',
      });
      this.connected = true;
    } catch {
      this.walletClient = null;
      throw new Error('MetaNet Desktop not running or unreachable at localhost:3321');
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.walletClient = null;
  }

  async getAddress(protocol?: string, slug?: string): Promise<string> {
    this.ensureConnected();
    const sdk = await getSDK();
    const protocolID: [number, string] = protocol
      ? [1, protocol]
      : [1, 'mint-address'];
    const keyID = slug || '1';
    const { publicKey: pubKeyHex } = await this.walletClient.getPublicKey({
      protocolID,
      keyID,
    });
    const pubKey = sdk.PublicKey.fromString(pubKeyHex);
    return pubKey.toAddress().toString();
  }

  async getBalance(): Promise<number> {
    return -1; // Wallet-managed, not queryable
  }

  async getStatus(): Promise<WalletProviderStatus> {
    if (!this.connected) {
      return {
        type: 'metanet',
        connected: false,
        address: null,
        publicKey: null,
        balance: null,
        handle: null,
      };
    }
    try {
      const address = await this.getAddress();
      return {
        type: 'metanet',
        connected: true,
        address,
        publicKey: null,
        balance: null,
        handle: null,
      };
    } catch {
      return {
        type: 'metanet',
        connected: false,
        address: null,
        publicKey: null,
        balance: null,
        handle: null,
      };
    }
  }

  async createAction(args: CreateActionArgs): Promise<CreateActionResult> {
    this.ensureConnected();
    const result = await this.walletClient.createAction({
      description: args.description,
      outputs: args.outputs.map((o) => ({
        lockingScript: o.lockingScript,
        satoshis: o.satoshis,
      })),
      labels: args.labels || [],
    });
    return {
      txid: result.txid || '',
      rawTx: result.rawTx
        ? Buffer.from(result.rawTx).toString('hex')
        : undefined,
    };
  }

  async broadcast(rawHex: string): Promise<string> {
    throw new Error(
      'MetaNet wallet handles broadcast via createAction(). Use createAction instead.',
    );
  }

  private ensureConnected() {
    if (!this.connected || !this.walletClient) {
      throw new Error('MetaNet wallet not connected. Call connect() first.');
    }
  }
}

/**
 * Detect if MetaNet Desktop is reachable.
 * Non-blocking — returns false if unreachable.
 */
export async function isMetaNetAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:3321', {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}
