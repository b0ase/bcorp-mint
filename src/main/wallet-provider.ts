import type { Transaction } from '@bsv/sdk';

export type WalletProviderType = 'local' | 'handcash' | 'metanet';

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
  outputs: Array<{ lockingScript: string; satoshis: number }>;
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
  sign(tx: Transaction): Promise<Transaction>;
  broadcast(rawHex: string): Promise<string>;
  getBalance(): Promise<number>;
  getStatus(): Promise<WalletProviderStatus>;
  createAction?(args: CreateActionArgs): Promise<CreateActionResult>;
}
