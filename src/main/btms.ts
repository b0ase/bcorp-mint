/**
 * BTMS (Basic Token Management System) integration.
 *
 * Wraps @bsv/btms to expose issuance / send / receive / burn / query
 * operations over IPC. Uses the Mint's existing BRC-100 wallet
 * (MetaNet Desktop on localhost:3321), so no additional wallet setup
 * is needed — if the Mint can talk to MetaNet, BTMS works.
 *
 * Asset taxonomy (Mint-specific extension):
 *   BTMS asset metadata carries an `asset_class` field:
 *     'stock' | 'bond' | 'token' | 'currency'
 *   Stocks and bonds are securities — the renderer gates issuance of
 *   those behind a verified BRC-KYC-Certificate. Tokens and currency
 *   are unrestricted.
 *
 * Privacy note: BTMS operations are overlay-indexed (Topic Manager +
 * Lookup Service). Unlike ComfyUI + stamp inscriptions, BTMS traffic
 * does touch public overlay endpoints. Users who want strict local
 * operation should stay in Stamp or Tokenise mode.
 */

import { BTMS } from '@bsv/btms';
import type {
  BTMSAsset,
  BTMSAssetMetadata,
  IssueResult,
  SendResult,
  AcceptResult,
  BurnResult,
  IncomingToken,
} from '@bsv/btms';
import { WalletClient, HTTPWalletJSON } from '@bsv/sdk';
import { MessageBoxClient } from '@bsv/message-box-client';

const METANET_URL = 'http://127.0.0.1:3321';
const NETWORK_PRESET =
  (process.env.BTMS_NETWORK_PRESET as 'local' | 'mainnet' | 'testnet' | undefined) ?? 'mainnet';

let btmsInstance: BTMS | null = null;
let walletClientInstance: WalletClient | null = null;

function getWalletClient(): WalletClient {
  if (!walletClientInstance) {
    const substrate = new HTTPWalletJSON(METANET_URL);
    walletClientInstance = new WalletClient(substrate);
  }
  return walletClientInstance;
}

async function ensureAuthenticated(): Promise<void> {
  const wallet = getWalletClient();
  const { authenticated } = await wallet.isAuthenticated();
  if (!authenticated) {
    throw new Error(
      'MetaNet Desktop is not authenticated. Unlock the wallet, then retry.'
    );
  }
}

function getBtms(): BTMS {
  if (!btmsInstance) {
    const wallet = getWalletClient();
    const comms = new MessageBoxClient();
    btmsInstance = new BTMS({
      wallet,
      networkPreset: NETWORK_PRESET,
      comms,
    });
  }
  return btmsInstance;
}

// --- Extended metadata for Mint-specific asset classes ---

export type AssetClass = 'stock' | 'bond' | 'token' | 'currency';

export interface MintAssetMetadata extends BTMSAssetMetadata {
  asset_class?: AssetClass;
  /** Optional BRC-KYC-Certificate JSON (stringified) attached to issuance */
  kyc_certificate?: string;
  /** DER-hex signature of the certificate (for verification) */
  kyc_certificate_signature?: string;
}

const SECURITIES_CLASSES: ReadonlySet<AssetClass> = new Set(['stock', 'bond']);

export function isSecurities(assetClass?: string): boolean {
  return !!assetClass && SECURITIES_CLASSES.has(assetClass as AssetClass);
}

// --- Operations ---

export async function btmsStatus(): Promise<{
  walletReady: boolean;
  networkPreset: string;
  identityKey: string | null;
  reason?: string;
}> {
  try {
    const wallet = getWalletClient();
    const { authenticated } = await wallet.isAuthenticated();
    if (!authenticated) {
      return {
        walletReady: false,
        networkPreset: NETWORK_PRESET,
        identityKey: null,
        reason: 'MetaNet Desktop not authenticated',
      };
    }
    const { publicKey } = await wallet.getPublicKey({ identityKey: true });
    return {
      walletReady: true,
      networkPreset: NETWORK_PRESET,
      identityKey: publicKey,
    };
  } catch (err) {
    return {
      walletReady: false,
      networkPreset: NETWORK_PRESET,
      identityKey: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function btmsIssue(input: {
  amount: number;
  metadata?: MintAssetMetadata;
}): Promise<IssueResult> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.issue(input.amount, input.metadata);
}

export async function btmsListAssets(): Promise<BTMSAsset[]> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.listAssets();
}

export async function btmsGetBalance(assetId: string): Promise<number> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.getBalance(assetId);
}

export async function btmsSend(input: {
  assetId: string;
  recipient: string;
  amount: number;
}): Promise<SendResult> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.send(input.assetId, input.recipient, input.amount);
}

export async function btmsListIncoming(): Promise<IncomingToken[]> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.listIncoming();
}

export async function btmsAccept(payment: IncomingToken): Promise<AcceptResult> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.accept(payment);
}

export async function btmsBurn(input: {
  assetId: string;
  amount?: number;
}): Promise<BurnResult> {
  await ensureAuthenticated();
  const btms = getBtms();
  return btms.burn(input.assetId, input.amount);
}
