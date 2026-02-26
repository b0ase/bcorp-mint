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

export interface WalletProvider {
  type: WalletProviderType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(protocol?: string, slug?: string): Promise<string>;
  sign(tx: Transaction): Promise<Transaction>;
  broadcast(rawHex: string): Promise<string>;
  getBalance(): Promise<number>;
  getStatus(): Promise<WalletProviderStatus>;
}
