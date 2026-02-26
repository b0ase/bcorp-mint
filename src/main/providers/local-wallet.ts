import { PrivateKey, Transaction, P2PKH } from '@bsv/sdk';
import type { WalletProvider, WalletProviderStatus } from '../wallet-provider';
import { hasMasterKey, loadMasterKey, hasPrivateKey, loadPrivateKey } from '../keystore';
import { deriveChildKey, getMasterKeyInfo } from '../wallet-derivation';
import { broadcastTx } from '../bsv';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

export class LocalWallet implements WalletProvider {
  type = 'local' as const;
  private connected = false;

  async connect(): Promise<void> {
    // Verify we have either master key or legacy key
    const hasMaster = await hasMasterKey();
    const hasLegacy = await hasPrivateKey();
    if (!hasMaster && !hasLegacy) {
      throw new Error('No local key found. Set up a master key first.');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getAddress(protocol?: string, slug?: string): Promise<string> {
    if (protocol && slug && await hasMasterKey()) {
      const masterHex = await loadMasterKey();
      const childKey = deriveChildKey(masterHex, protocol, slug);
      return childKey.toPublicKey().toAddress().toString();
    }
    // Default: master address or legacy
    if (await hasMasterKey()) {
      const masterHex = await loadMasterKey();
      const info = getMasterKeyInfo(masterHex);
      return info.address;
    }
    const wif = await loadPrivateKey();
    return PrivateKey.fromWif(wif).toPublicKey().toAddress().toString();
  }

  async sign(tx: Transaction): Promise<Transaction> {
    await tx.sign();
    return tx;
  }

  async broadcast(rawHex: string): Promise<string> {
    return broadcastTx(rawHex);
  }

  async getBalance(): Promise<number> {
    const address = await this.getAddress();
    try {
      const res = await fetch(`${WHATSONCHAIN_API}/address/${address}/balance`);
      if (!res.ok) return 0;
      const data = await res.json() as { confirmed: number; unconfirmed: number };
      return data.confirmed + data.unconfirmed;
    } catch {
      return 0;
    }
  }

  async getStatus(): Promise<WalletProviderStatus> {
    const hasMaster = await hasMasterKey();
    const hasLegacy = await hasPrivateKey();
    const available = hasMaster || hasLegacy;

    if (!available) {
      return { type: 'local', connected: false, address: null, publicKey: null, balance: null, handle: null };
    }

    let address: string | null = null;
    let publicKey: string | null = null;

    if (hasMaster) {
      const masterHex = await loadMasterKey();
      const info = getMasterKeyInfo(masterHex);
      address = info.address;
      publicKey = info.publicKey;
    } else if (hasLegacy) {
      const wif = await loadPrivateKey();
      const pk = PrivateKey.fromWif(wif);
      address = pk.toPublicKey().toAddress().toString();
      publicKey = pk.toPublicKey().toString();
    }

    return {
      type: 'local',
      connected: this.connected && available,
      address,
      publicKey,
      balance: null, // Fetched on demand
      handle: null,
    };
  }
}
