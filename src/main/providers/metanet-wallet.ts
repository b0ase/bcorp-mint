import type { Transaction } from '@bsv/sdk';
import { WalletClient, HTTPWalletJSON, PublicKey } from '@bsv/sdk';
import type { WalletProvider, WalletProviderStatus, CreateActionArgs, CreateActionResult } from '../wallet-provider';
import * as net from 'node:net';

const METANET_PORT = 3321;
const METANET_HOST = '127.0.0.1';
const METANET_URL = `http://${METANET_HOST}:${METANET_PORT}`;

/**
 * MetaNet Desktop / BabbageGo wallet provider.
 * Uses BRC-100 WalletClient via HTTPWalletJSON to communicate with
 * the locally-running MetaNet Client on TCP 3321.
 */
export class MetaNetWallet implements WalletProvider {
  type = 'metanet' as const;
  supportsCreateAction = true;
  private connected = false;
  private wallet: WalletClient | null = null;

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

  private ensureWallet(): WalletClient {
    if (!this.wallet) {
      const substrate = new HTTPWalletJSON(METANET_URL);
      this.wallet = new WalletClient(substrate);
    }
    return this.wallet;
  }

  async connect(): Promise<void> {
    const available = await MetaNetWallet.isAvailable();
    if (!available) {
      throw new Error('MetaNet Desktop is not running. Please start it and try again.');
    }

    const wallet = this.ensureWallet();
    const { authenticated } = await wallet.isAuthenticated();
    if (!authenticated) {
      throw new Error('MetaNet Desktop is running but not authenticated. Please unlock your wallet.');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.wallet = null;
  }

  async getAddress(): Promise<string> {
    const wallet = this.ensureWallet();
    const { publicKey: pubKeyHex } = await wallet.getPublicKey({
      protocolID: [1, 'mint-address'],
      keyID: '1',
    });
    const pubKey = PublicKey.fromString(pubKeyHex);
    return pubKey.toAddress().toString();
  }

  async sign(_tx: Transaction): Promise<Transaction> {
    throw new Error(
      'MetaNet Desktop uses BRC-100 createAction() for signing. ' +
      'Direct transaction signing is not supported — the wallet manages UTXOs internally.'
    );
  }

  async broadcast(_rawHex: string): Promise<string> {
    throw new Error(
      'MetaNet Desktop broadcasts via BRC-100 createAction(). ' +
      'Direct broadcast is not supported — the wallet handles broadcasting internally.'
    );
  }

  async getBalance(): Promise<number> {
    // BRC-100 wallets manage balance internally — no direct balance query
    // Return -1 to indicate "wallet-managed" (UI can show "Managed by MetaNet")
    return -1;
  }

  /**
   * BRC-100 createAction — the core method for MetaNet wallet operations.
   * The wallet builds the transaction, handles UTXO selection, signing,
   * and broadcasting internally.
   */
  async createAction(args: CreateActionArgs): Promise<CreateActionResult> {
    if (!this.connected) {
      throw new Error('MetaNet Desktop is not connected. Please connect first.');
    }

    const wallet = this.ensureWallet();

    const result = await wallet.createAction({
      description: args.description,
      outputs: args.outputs.map((o) => ({
        lockingScript: o.lockingScript,
        satoshis: o.satoshis,
      })),
      labels: args.labels || [],
    });

    return {
      txid: result.txid || '',
      rawTx: result.rawTx ? Buffer.from(result.rawTx).toString('hex') : undefined,
    };
  }

  async getStatus(): Promise<WalletProviderStatus> {
    const available = await MetaNetWallet.isAvailable();

    if (!available) {
      return {
        type: 'metanet',
        connected: false,
        address: null,
        publicKey: null,
        balance: null,
        handle: null,
      };
    }

    let authenticated = false;
    let address: string | null = null;
    let publicKey: string | null = null;

    try {
      const wallet = this.ensureWallet();
      const authResult = await wallet.isAuthenticated();
      authenticated = authResult.authenticated;

      if (authenticated) {
        const { publicKey: pubKeyHex } = await wallet.getPublicKey({
          protocolID: [1, 'mint-address'],
          keyID: '1',
        });
        publicKey = pubKeyHex;
        const pubKey = PublicKey.fromString(pubKeyHex);
        address = pubKey.toAddress().toString();
      }
    } catch {
      // If wallet probe fails, report as disconnected
    }

    return {
      type: 'metanet',
      connected: this.connected && authenticated,
      address,
      publicKey,
      balance: null, // Managed by MetaNet Desktop
      handle: null,
    };
  }
}
