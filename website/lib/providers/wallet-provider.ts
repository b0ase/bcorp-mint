/**
 * BRC-100 Wallet Provider Interface
 *
 * Matches desktop app's WalletProvider (src/main/wallet-provider.ts).
 * All wallet operations route through this interface for interoperability.
 */

export type WalletProviderType = 'local' | 'handcash' | 'metanet' | 'bwallet';

export type WalletProviderStatus = {
  type: WalletProviderType;
  connected: boolean;
  address: string | null;
  publicKey: string | null;
  balance: number | null;
  handle: string | null;
};

export type CreateActionArgs = {
  description: string;
  outputs: Array<{
    lockingScript: string;
    satoshis: number;
    /** BRC-100: 5 to 50 bytes. Defaults to a generic description. */
    outputDescription?: string;
    /** Optional basket the wallet files the output under. */
    basket?: string;
  }>;
  labels?: string[];
};

export type CreateActionResult = {
  txid: string;
  rawTx?: string;
};

export interface WalletProvider {
  type: WalletProviderType;
  supportsCreateAction: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(protocol?: string, slug?: string): Promise<string>;
  getBalance(): Promise<number>;
  getStatus(): Promise<WalletProviderStatus>;
  broadcast?(rawHex: string): Promise<string>;
  createAction?(args: CreateActionArgs): Promise<CreateActionResult>;
  /** Sign an arbitrary message; `address` identifies the signer. */
  signMessage?(message: string): Promise<{ signature: string; address: string }>;
}
