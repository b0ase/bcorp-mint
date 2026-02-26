import type { Transaction } from '@bsv/sdk';
import type { WalletProvider, WalletProviderStatus } from '../wallet-provider';
import * as net from 'node:net';

const METANET_PORT = 3321;
const METANET_HOST = '127.0.0.1';

/**
 * MetaNet Desktop / BabbageGo wallet provider.
 * Communicates with the locally-running MetaNet Client on TCP 3321.
 */
export class MetaNetWallet implements WalletProvider {
  type = 'metanet' as const;
  private connected = false;

  /**
   * Check if MetaNet Desktop is running by probing TCP 3321.
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        resolve(false);
      });
      socket.connect(METANET_PORT, METANET_HOST);
    });
  }

  async connect(): Promise<void> {
    const available = await MetaNetWallet.isAvailable();
    if (!available) {
      throw new Error('MetaNet Desktop is not running. Please start it and try again.');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getAddress(): Promise<string> {
    // MetaNet Desktop manages addresses internally
    // This would use WalletClient from @bsv/sdk in a full implementation
    return 'metanet-managed';
  }

  async sign(_tx: Transaction): Promise<Transaction> {
    // MetaNet Desktop handles signing via WalletClient.createAction()
    throw new Error('MetaNet Desktop signs via WalletClient.createAction() — use that API instead.');
  }

  async broadcast(_rawHex: string): Promise<string> {
    throw new Error('MetaNet Desktop broadcasts via WalletClient — use createAction().');
  }

  async getBalance(): Promise<number> {
    // Balance managed by MetaNet Desktop
    return 0;
  }

  async getStatus(): Promise<WalletProviderStatus> {
    const available = await MetaNetWallet.isAvailable();
    return {
      type: 'metanet',
      connected: this.connected && available,
      address: this.connected ? 'metanet-managed' : null,
      publicKey: null,
      balance: null,
      handle: null,
    };
  }
}
