import { PrivateKey, Transaction, P2PKH, Script } from '@bsv/sdk';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BrowserWindow } from 'electron';
import { loadMasterKey } from './keystore';
import { deriveChildKey } from './wallet-derivation';
import { broadcastTx } from './bsv';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';
const NULL_PARENT = '00'.repeat(32); // 32 zero bytes for root node parent

export type MetaNetNode = {
  txid: string;
  path: string;
  segment: string;
  isDirectory: boolean;
  publicKey: string;
  address: string;
  parentTxid: string;
  contentHash: string | null;
  contentType: string | null;
  condition: string;
  conditionData: string;
};

export type MetaNetTreeResult = {
  root: MetaNetNode;
  nodes: MetaNetNode[];
  totalNodes: number;
  totalCost: number;
};

type Utxo = { tx_hash: string; tx_pos: number; value: number };

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const res = await fetch(`${WHATSONCHAIN_API}/address/${address}/unspent`);
  if (!res.ok) throw new Error(`Failed to fetch UTXOs: ${res.statusText}`);
  return res.json() as Promise<Utxo[]>;
}

function sendProgress(data: { stage: string; completed: number; total: number; currentPath?: string }) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('metanet-progress', data);
}

/**
 * Hash a file with SHA-256.
 */
async function hashFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Detect MIME type from file extension.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
    '.json': 'application/json', '.html': 'text/html', '.css': 'text/css',
    '.js': 'text/javascript', '.ts': 'text/typescript',
  };
  return mimes[ext] || 'application/octet-stream';
}

/**
 * Build a MetaNet OP_RETURN transaction.
 *
 * Format: OP_FALSE OP_RETURN "meta" <P_node> <TxID_parent> <path_segment>
 *         <content_hash> <content_type> <timestamp> <condition> <condition_data>
 */
async function buildMetaNetTx(
  signingKey: PrivateKey,
  parentTxid: string,
  segment: string,
  contentHash: string | null,
  contentType: string | null,
  condition: string,
  conditionData: string,
): Promise<{ tx: Transaction; address: string }> {
  const pubKey = signingKey.toPublicKey();
  const address = pubKey.toAddress();

  const utxos = await fetchUtxos(address.toString());
  if (utxos.length === 0) {
    throw new Error(`No UTXOs for MetaNet node at ${address.toString()}. Fund this address first.`);
  }

  const tx = new Transaction();
  const utxo = utxos[0];

  tx.addInput({
    sourceTXID: utxo.tx_hash,
    sourceOutputIndex: utxo.tx_pos,
    unlockingScriptTemplate: new P2PKH().unlock(signingKey),
  });

  // MetaNet OP_RETURN
  const opReturn = new Script();
  opReturn.writeOpCode(0);   // OP_FALSE
  opReturn.writeOpCode(106); // OP_RETURN
  opReturn.writeBin(Array.from(Buffer.from('meta', 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(pubKey.toString(), 'hex')));
  opReturn.writeBin(Array.from(Buffer.from(parentTxid, 'hex')));
  opReturn.writeBin(Array.from(Buffer.from(segment, 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(contentHash || '', 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(contentType || '', 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(new Date().toISOString(), 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(condition, 'utf8')));
  opReturn.writeBin(Array.from(Buffer.from(conditionData, 'utf8')));

  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });

  // Change output
  const minerFee = 500;
  const change = utxo.value - minerFee;
  if (change < 0) throw new Error('Insufficient satoshis for MetaNet node');
  if (change > 0) {
    tx.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: change });
  }

  await tx.sign();
  return { tx, address: address.toString() };
}

/**
 * Create the root MetaNet node (no parent).
 */
export async function createRootNode(
  masterKeyHex: string,
  rootPath: string,
  condition = '',
  conditionData = '',
): Promise<MetaNetNode> {
  const signingKey = deriveChildKey(masterKeyHex, '$FOLDER', rootPath);
  const pubKey = signingKey.toPublicKey();

  const { tx, address } = await buildMetaNetTx(
    signingKey, NULL_PARENT, rootPath, null, null, condition, conditionData,
  );

  const txid = await broadcastTx(tx.toHex());

  return {
    txid,
    path: rootPath,
    segment: rootPath,
    isDirectory: true,
    publicKey: pubKey.toString(),
    address,
    parentTxid: NULL_PARENT,
    contentHash: null,
    contentType: null,
    condition,
    conditionData,
  };
}

/**
 * Create a child MetaNet node with a parent.
 */
export async function createChildNode(
  masterKeyHex: string,
  parentNode: MetaNetNode,
  segment: string,
  content?: { filePath: string },
  condition = '',
  conditionData = '',
): Promise<MetaNetNode> {
  const childPath = parentNode.path === '/' ? `/${segment}` : `${parentNode.path}/${segment}`;
  const isDirectory = !content;
  const protocol = isDirectory ? '$FOLDER' : '$FILE';

  const signingKey = deriveChildKey(masterKeyHex, protocol, childPath);
  const pubKey = signingKey.toPublicKey();

  let contentHash: string | null = null;
  let contentType: string | null = null;

  if (content) {
    contentHash = await hashFile(content.filePath);
    contentType = getMimeType(content.filePath);
  }

  const { tx, address } = await buildMetaNetTx(
    signingKey, parentNode.txid, segment, contentHash, contentType, condition, conditionData,
  );

  const txid = await broadcastTx(tx.toHex());

  return {
    txid,
    path: childPath,
    segment,
    isDirectory,
    publicKey: pubKey.toString(),
    address,
    parentTxid: parentNode.txid,
    contentHash,
    contentType,
    condition,
    conditionData,
  };
}

type FsEntry = {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  children: FsEntry[];
};

/**
 * Recursively scan a folder into an in-memory tree.
 */
async function scanFolder(folderPath: string, relativeTo: string): Promise<FsEntry[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const result: FsEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // Skip hidden files
    const fullPath = path.join(folderPath, entry.name);
    const relativePath = path.relative(relativeTo, fullPath);

    if (entry.isDirectory()) {
      const children = await scanFolder(fullPath, relativeTo);
      result.push({ name: entry.name, path: fullPath, relativePath, isDirectory: true, size: 0, children });
    } else {
      const stat = await fs.stat(fullPath);
      result.push({ name: entry.name, path: fullPath, relativePath, isDirectory: false, size: stat.size, children: [] });
    }
  }

  return result.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Count total nodes in a tree.
 */
function countNodes(entries: FsEntry[]): number {
  let count = 0;
  for (const e of entries) {
    count += 1;
    if (e.isDirectory) count += countNodes(e.children);
  }
  return count;
}

/**
 * Estimate cost to inscribe a folder tree.
 * ~500 sats per node transaction.
 */
export async function estimateTreeCost(folderPath: string): Promise<{ nodes: number; estimatedSats: number }> {
  const entries = await scanFolder(folderPath, folderPath);
  const nodes = countNodes(entries) + 1; // +1 for root
  return { nodes, estimatedSats: nodes * 500 };
}

/**
 * Build a full MetaNet tree from a folder.
 * Broadcasts root first, then breadth-first for children.
 */
export async function buildMetaNetTree(
  masterKeyHex: string,
  folderPath: string,
  stampPath: string,
  conditions?: Map<string, { condition: string; conditionData: string }>,
): Promise<MetaNetTreeResult> {
  const entries = await scanFolder(folderPath, folderPath);
  const totalNodes = countNodes(entries) + 1;
  const allNodes: MetaNetNode[] = [];

  sendProgress({ stage: 'Creating root node...', completed: 0, total: totalNodes });

  const rootCondition = conditions?.get('/');
  const root = await createRootNode(
    masterKeyHex, stampPath,
    rootCondition?.condition || '',
    rootCondition?.conditionData || '',
  );
  allNodes.push(root);

  // Breadth-first queue: [entry, parentNode]
  const queue: Array<[FsEntry, MetaNetNode]> = entries.map((e) => [e, root]);

  while (queue.length > 0) {
    const [entry, parent] = queue.shift()!;
    const completed = allNodes.length;

    sendProgress({
      stage: entry.isDirectory ? `Creating folder: ${entry.name}` : `Inscribing: ${entry.name}`,
      completed,
      total: totalNodes,
      currentPath: entry.relativePath,
    });

    const entryCondition = conditions?.get(entry.relativePath);

    try {
      const node = await createChildNode(
        masterKeyHex,
        parent,
        entry.name,
        entry.isDirectory ? undefined : { filePath: entry.path },
        entryCondition?.condition || '',
        entryCondition?.conditionData || '',
      );
      allNodes.push(node);

      // Queue children if directory
      if (entry.isDirectory) {
        for (const child of entry.children) {
          queue.push([child, node]);
        }
      }

      // Rate limit: 200ms between broadcasts
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`MetaNet node failed for ${entry.relativePath}:`, err);
    }
  }

  sendProgress({ stage: 'Done', completed: totalNodes, total: totalNodes });

  return {
    root,
    nodes: allNodes,
    totalNodes: allNodes.length,
    totalCost: allNodes.length * 500,
  };
}
