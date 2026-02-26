/**
 * HandCash Pay API — OP_RETURN inscription via HandCash wallet.
 *
 * Uses the HandCash Connect Pay endpoint to send a transaction with
 * OP_RETURN data attached. The user's HandCash wallet pays the miner fee
 * and signs the transaction server-side.
 *
 * Requires an active authToken from the HandCash OAuth flow.
 */

import { getWalletState } from './handcash';
import { TREASURY_HANDLE, MINT_FEE_USD } from './treasury';

const HC_APP_ID = process.env.HANDCASH_APP_ID || '';
const HC_APP_SECRET = process.env.HANDCASH_APP_SECRET || '';

export interface HandCashPayResult {
  transactionId: string;
  note: string;
}

/**
 * Send a payment with OP_RETURN data via HandCash Pay API.
 *
 * The payment sends a dust amount to the user's own paymail
 * with attached OP_RETURN data containing the document hashes.
 */
export async function handCashPayWithData(payload: {
  description: string;
  opReturnData: string[];
}): Promise<HandCashPayResult> {
  const state = getWalletState();
  if (!state.authToken) {
    throw new Error('HandCash not connected. Please connect your wallet first.');
  }
  if (!state.handle) {
    throw new Error('HandCash handle not resolved. Please reconnect.');
  }

  // Build the payment request
  // HandCash Pay API: POST /v3/wallet/pay
  // Treasury receives mint fee; user's wallet pays miner fee + treasury fee
  const paymentBody = {
    description: payload.description,
    appAction: 'ip-hash-inscription',
    receivers: [
      {
        to: TREASURY_HANDLE,
        amount: MINT_FEE_USD,
        currencyCode: 'USD',
      },
    ],
    attachment: {
      format: 'json',
      value: {
        protocol: 'BCORP_IP_HASH',
        data: payload.opReturnData,
      },
    },
  };

  const res = await fetch('https://cloud.handcash.io/v3/wallet/pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'app-id': HC_APP_ID,
      'app-secret': HC_APP_SECRET,
      'Authorization': `Bearer ${state.authToken}`,
    },
    body: JSON.stringify(paymentBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HandCash Pay failed (${res.status}): ${errText}`);
  }

  const result = await res.json() as { transactionId?: string; note?: string };
  if (!result.transactionId) {
    throw new Error('HandCash Pay returned no transaction ID');
  }

  return {
    transactionId: result.transactionId,
    note: result.note || payload.description,
  };
}

/**
 * Inscribe document hashes on BSV via HandCash wallet.
 *
 * Builds the OP_RETURN payload and sends it through HandCash Pay.
 */
export async function inscribeHashesViaHandCash(hashes: Array<{
  file: string;
  sha256: string;
}>): Promise<{ txid: string }> {
  const timestamp = new Date().toISOString();

  const opReturnData = [
    'BCORP_IP_HASH',
    `ts:${timestamp}`,
    ...hashes.map((h) => `${h.file}:${h.sha256}`),
  ];

  const description = `IP Hash Inscription — ${hashes.length} document(s) — ${timestamp}`;

  const result = await handCashPayWithData({
    description,
    opReturnData,
  });

  return { txid: result.transactionId };
}
