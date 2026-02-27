/**
 * Ownership Chain — Pure functions for cryptographic title transfer.
 *
 * This is NOT $403 registration. It's cryptographic endorsement —
 * like signing the back of a check. If regulatory registration is
 * needed, that's a $403 condition layered on top.
 */

import type { OwnershipChain, TransferEndorsement } from './types';

/**
 * Build the deterministic message to be signed for an issuance.
 */
export function buildIssuanceMessage(assetHash: string, issuerAddress: string, timestamp: string): string {
  return `ISSUE|${assetHash}|BY:${issuerAddress}|AT:${timestamp}`;
}

/**
 * Build the deterministic message to be signed for a transfer.
 */
export function buildTransferMessage(assetHash: string, fromAddress: string, toAddress: string, timestamp: string): string {
  return `TRANSFER|${assetHash}|FROM:${fromAddress}|TO:${toAddress}|AT:${timestamp}`;
}

/**
 * Create an initial ownership chain with the issuance event.
 */
export function createIssuance(opts: {
  assetId: string;
  assetHash: string;
  assetType: OwnershipChain['assetType'];
  issuerAddress: string;
  issuerName: string;
  signature: string;
  txid?: string;
}): OwnershipChain {
  const timestamp = new Date().toISOString();
  return {
    assetId: opts.assetId,
    assetHash: opts.assetHash,
    assetType: opts.assetType,
    issuance: {
      issuerAddress: opts.issuerAddress,
      issuerName: opts.issuerName,
      signature: opts.signature,
      signedMessage: buildIssuanceMessage(opts.assetHash, opts.issuerAddress, timestamp),
      timestamp,
      txid: opts.txid,
    },
    transfers: [],
    currentHolder: {
      address: opts.issuerAddress,
      name: opts.issuerName,
    },
  };
}

/**
 * Add a transfer endorsement to an existing chain.
 * Returns a new chain (immutable).
 */
export function createTransfer(
  chain: OwnershipChain,
  opts: {
    toAddress: string;
    toName: string;
    signature: string;
    walletType: string;
    txid?: string;
  },
): OwnershipChain {
  const timestamp = new Date().toISOString();
  const endorsement: TransferEndorsement = {
    id: crypto.randomUUID(),
    fromAddress: chain.currentHolder.address,
    fromName: chain.currentHolder.name,
    toAddress: opts.toAddress,
    toName: opts.toName,
    signature: opts.signature,
    signedMessage: buildTransferMessage(chain.assetHash, chain.currentHolder.address, opts.toAddress, timestamp),
    timestamp,
    txid: opts.txid,
    walletType: opts.walletType,
  };

  return {
    ...chain,
    transfers: [...chain.transfers, endorsement],
    currentHolder: {
      address: opts.toAddress,
      name: opts.toName,
    },
  };
}

/**
 * Get the current holder of the chain.
 */
export function getCurrentHolder(chain: OwnershipChain): { address: string; name: string } {
  return chain.currentHolder;
}

/**
 * Verify all endorsements in the chain form a valid sequence.
 * Returns per-endorsement results plus an overall valid flag.
 *
 * Note: This verifies chain integrity (sequence + message format),
 * NOT cryptographic signature validity — that requires the public
 * key registry. Signature verification is platform-dependent.
 */
export function verifyChain(chain: OwnershipChain): {
  valid: boolean;
  issuanceValid: boolean;
  endorsements: Array<{ id: string; valid: boolean; reason?: string }>;
} {
  // Verify issuance
  const expectedIssuanceMsg = buildIssuanceMessage(
    chain.assetHash,
    chain.issuance.issuerAddress,
    chain.issuance.timestamp,
  );
  const issuanceValid = chain.issuance.signedMessage === expectedIssuanceMsg && chain.issuance.signature.length > 0;

  // Verify transfer chain
  let lastAddress = chain.issuance.issuerAddress;
  const endorsements = chain.transfers.map((t) => {
    // Check from-address matches last holder
    if (t.fromAddress !== lastAddress) {
      return { id: t.id, valid: false, reason: `Expected from ${lastAddress}, got ${t.fromAddress}` };
    }

    // Check message format
    const expectedMsg = buildTransferMessage(chain.assetHash, t.fromAddress, t.toAddress, t.timestamp);
    if (t.signedMessage !== expectedMsg) {
      return { id: t.id, valid: false, reason: 'Signed message mismatch' };
    }

    // Check signature is present
    if (!t.signature || t.signature.length === 0) {
      return { id: t.id, valid: false, reason: 'Missing signature' };
    }

    lastAddress = t.toAddress;
    return { id: t.id, valid: true };
  });

  // Verify current holder matches last transfer
  const expectedHolder = chain.transfers.length > 0
    ? chain.transfers[chain.transfers.length - 1].toAddress
    : chain.issuance.issuerAddress;
  const holderValid = chain.currentHolder.address === expectedHolder;

  return {
    valid: issuanceValid && endorsements.every((e) => e.valid) && holderValid,
    issuanceValid,
    endorsements,
  };
}

/**
 * Compute SHA-256 hash of data.
 */
export async function sha256Hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
