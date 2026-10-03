/**
 * bWallet BRC-100 Wallet Provider (Browser)
 *
 * The wallet the Mint runs inside as a bApp. Reaches it through `window.CWI` in the
 * full-screen browser / extension, or over the XDM postMessage substrate in-frame
 * (`@bsv/sdk` WalletClient 'auto' picks whichever answers).
 *
 * Identity: BRC-100 identity key, with the $handle resolved from bWallet's paymail
 * server. Payments and inscriptions: createAction, so the wallet funds, prompts,
 * signs and broadcasts. No keys, no seed phrases, no cookies.
 */

import {
  bwalletCreateAction,
  bwalletSignMessage,
  connectBWallet,
  getBWalletClient,
  isBWalletAvailable,
  resetBWalletClient,
  type BWalletIdentity,
} from '@shared/lib/bwallet';
import type {
  WalletProvider,
  WalletProviderStatus,
  CreateActionArgs,
  CreateActionResult,
} from './wallet-provider';

export class BWalletProvider implements WalletProvider {
  type = 'bwallet' as const;
  supportsCreateAction = true;
  private identity: BWalletIdentity | null = null;

  get connected(): boolean {
    return this.identity !== null;
  }

  /** Identity key, $handle and paymail of the connected user, or null. */
  getIdentity(): BWalletIdentity | null {
    return this.identity;
  }

  async connect(): Promise<void> {
    this.identity = await connectBWallet();
  }

  async disconnect(): Promise<void> {
    this.identity = null;
    resetBWalletClient();
  }

  /**
   * Where the wallet receives outputs the Mint creates for the user.
   * Preference: the ordinals address the paymail profile publishes (that is where
   * bWallet looks for tokens). Otherwise a key the wallet derives for the Mint under
   * [1, protocol] / slug, which the wallet can always spend.
   */
  async getAddress(protocol?: string, slug?: string): Promise<string> {
    this.ensureConnected();
    if (this.identity?.ordAddress) return this.identity.ordAddress;
    const wallet = await getBWalletClient();
    const sdk = await import('@bsv/sdk');
    const { publicKey } = await wallet.getPublicKey({
      protocolID: [1, protocol || 'mint address'],
      keyID: slug || '1',
      counterparty: 'self',
    });
    return sdk.PublicKey.fromString(publicKey).toAddress().toString();
  }

  async getBalance(): Promise<number> {
    return -1; // the wallet shows balances; a bApp never reads them
  }

  async getStatus(): Promise<WalletProviderStatus> {
    const id = this.identity;
    return {
      type: 'bwallet',
      connected: id !== null,
      address: id?.ordAddress ?? null,
      publicKey: id?.identityKey ?? null,
      balance: null,
      handle: id?.handle ?? null,
    };
  }

  async createAction(args: CreateActionArgs): Promise<CreateActionResult> {
    this.ensureConnected();
    const { txid } = await bwalletCreateAction({
      description: args.description,
      outputs: args.outputs.map((o) => ({
        lockingScript: o.lockingScript,
        satoshis: o.satoshis,
        outputDescription: o.outputDescription ?? 'Mint output',
        basket: o.basket,
      })),
      labels: args.labels,
    });
    return { txid };
  }

  async signMessage(message: string): Promise<{ signature: string; address: string }> {
    this.ensureConnected();
    const { signature, address } = await bwalletSignMessage(message);
    return { signature, address };
  }

  async broadcast(): Promise<string> {
    throw new Error('bWallet broadcasts through createAction().');
  }

  private ensureConnected() {
    if (!this.identity) throw new Error('bWallet not connected. Tap Connect bWallet first.');
  }
}

/** True when a BRC-100 wallet can be reached from this page (bWallet frame, bWallet browser, or an injected provider). */
export function isBWalletReachable(): boolean {
  return isBWalletAvailable();
}
