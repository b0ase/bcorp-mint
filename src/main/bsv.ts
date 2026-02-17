import { PrivateKey, Transaction, P2PKH, Script } from '@bsv/sdk';
import { loadPrivateKey } from './keystore';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';

type Utxo = { tx_hash: string; tx_pos: number; value: number };

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const res = await fetch(`${WHATSONCHAIN_API}/address/${address}/unspent`);
  if (!res.ok) throw new Error(`Failed to fetch UTXOs: ${res.statusText}`);
  return res.json() as Promise<Utxo[]>;
}

async function broadcastTx(rawHex: string): Promise<string> {
  const res = await fetch(`${WHATSONCHAIN_API}/tx/raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txhex: rawHex })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Broadcast failed: ${err}`);
  }
  const txid = await res.text();
  return txid.replace(/"/g, '');
}

/**
 * Inscribe a stamp on BSV via OP_RETURN.
 * Format: OP_RETURN | STAMP | <path> | <sha256> | <iso-timestamp>
 *
 * Private key is loaded from keystore internally — never crosses IPC.
 */
export async function inscribeStamp(payload: {
  path: string;
  hash: string;
  timestamp: string;
}): Promise<{ txid: string }> {
  const wif = await loadPrivateKey();
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  const utxos = await fetchUtxos(address);
  if (utxos.length === 0) {
    throw new Error('No UTXOs found. Please fund your stamper wallet.');
  }

  const tx = new Transaction();
  const utxo = utxos[0];

  tx.addInput({
    sourceTXID: utxo.tx_hash,
    sourceOutputIndex: utxo.tx_pos,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey)
  });

  // Build OP_RETURN: STAMP | path | hash | timestamp
  const opReturn = new Script();
  opReturn.writeOpCode(106); // OP_RETURN
  opReturn.writeBin(Array.from(Buffer.from('STAMP', 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(payload.path, 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(payload.hash, 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(payload.timestamp, 'utf8')));

  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });

  // Change
  const minerFee = 500;
  const change = utxo.value - minerFee;
  if (change < 0) throw new Error('Insufficient satoshis for miner fee');
  if (change > 0) {
    tx.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: change });
  }

  await tx.sign();
  const txid = await broadcastTx(tx.toHex());
  return { txid };
}
