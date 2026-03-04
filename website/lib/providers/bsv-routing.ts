/**
 * BRC-100 Inscription Routing Layer
 *
 * Routes OP_RETURN inscriptions through the appropriate wallet provider.
 * Matches desktop app's routeOpReturnInscription() in src/main/bsv.ts.
 *
 * - Local wallet: delegates to mint-bridge (keystore + broadcast)
 * - MetaNet (BRC-100): uses createAction() — wallet handles UTXO/signing/broadcast
 * - HandCash: via /api/inscribe relay (server-side signing)
 */

import type { WalletProvider, CreateActionResult } from './wallet-provider';

/**
 * Build an OP_RETURN locking script hex from data fields.
 * Format: OP_FALSE OP_RETURN <field1> <field2> ...
 */
export function buildOpReturnScriptHex(dataFields: (string | Uint8Array)[]): string {
  const parts: number[] = [0x00, 0x6a]; // OP_FALSE OP_RETURN

  for (const field of dataFields) {
    const bytes =
      typeof field === 'string'
        ? new TextEncoder().encode(field)
        : field;
    // Push data with appropriate OP_PUSH
    if (bytes.length < 76) {
      parts.push(bytes.length);
    } else if (bytes.length < 256) {
      parts.push(0x4c, bytes.length); // OP_PUSHDATA1
    } else {
      parts.push(0x4d, bytes.length & 0xff, (bytes.length >> 8) & 0xff); // OP_PUSHDATA2
    }
    parts.push(...bytes);
  }

  return parts.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Route an OP_RETURN inscription through a BRC-100 wallet provider.
 *
 * Only handles providers that support createAction().
 * For local wallet, use mint-bridge functions directly.
 * For HandCash, use /api/inscribe.
 */
export async function routeInscription(
  provider: WalletProvider,
  dataFields: (string | Uint8Array)[],
  opts: {
    description?: string;
    labels?: string[];
  } = {},
): Promise<CreateActionResult> {
  if (!provider.supportsCreateAction || !provider.createAction) {
    throw new Error(
      `Provider "${provider.type}" does not support BRC-100 createAction(). ` +
      'Use provider-specific methods (mint-bridge for local, /api/inscribe for HandCash).',
    );
  }

  const lockingScript = buildOpReturnScriptHex(dataFields);
  return provider.createAction({
    description: opts.description || 'Mint inscription',
    outputs: [{ lockingScript, satoshis: 0 }],
    labels: opts.labels || ['mint', 'inscription'],
  });
}
