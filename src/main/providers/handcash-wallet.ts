import type { Transaction } from '@bsv/sdk';
import type { WalletProvider, WalletProviderStatus } from '../wallet-provider';
import { getRedirectUrl, getWalletState, disconnect, isConnected, getProfile } from '../handcash';
import { shell } from 'electron';

export class HandCashWallet implements WalletProvider {
  type = 'handcash' as const;
  supportsCreateAction = false;

  async connect(): Promise<void> {
    const url = await getRedirectUrl();
    await shell.openExternal(url);
    // OAuth callback will set the token in handcash.ts module state
  }

  async disconnect(): Promise<void> {
    disconnect();
  }

  async getAddress(): Promise<string> {
    const profile = await getProfile();
    if (!profile) throw new Error('HandCash not connected');
    // HandCash uses paymail, not raw addresses
    return `${profile.handle}@handcash.io`;
  }

  async sign(_tx: Transaction): Promise<Transaction> {
    // HandCash signs server-side via their API — not used for local signing
    throw new Error('HandCash does not support local transaction signing. Use HandCash Pay API instead.');
  }

  async broadcast(_rawHex: string): Promise<string> {
    throw new Error('HandCash broadcasts via their API — use HandCash Pay endpoints.');
  }

  async getBalance(): Promise<number> {
    const profile = await getProfile();
    return profile?.balance ?? 0;
  }

  async getStatus(): Promise<WalletProviderStatus> {
    const state = getWalletState();
    return {
      type: 'handcash',
      connected: state.connected,
      address: state.handle ? `${state.handle}@handcash.io` : null,
      publicKey: null,
      balance: state.balance,
      handle: state.handle,
    };
  }
}
