import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

export type FsNode = {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  hash: string | null;
  mimeType: string | null;
  children: FsNode[];
  metanetTxid: string | null;
  tokenId: string | null;
};

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.tif': 'image/tiff', '.tiff': 'image/tiff', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
  '.json': 'application/json', '.html': 'text/html', '.css': 'text/css',
  '.js': 'text/javascript', '.ts': 'text/typescript',
  '.xml': 'application/xml', '.csv': 'text/csv',
  '.zip': 'application/zip', '.gz': 'application/gzip',
};

/**
 * Recursively scan a folder into an FsNode tree.
 * NO extension filtering — accepts ALL file types for tokenisation.
 */
export async function scanFolder(folderPath: string, relativeTo?: string): Promise<FsNode> {
  const rootRelTo = relativeTo || folderPath;
  const stat = await fs.stat(folderPath);
  const name = path.basename(folderPath);

  if (!stat.isDirectory()) {
    const ext = path.extname(folderPath).toLowerCase();
    return {
      name,
      path: folderPath,
      relativePath: path.relative(rootRelTo, folderPath),
      isDirectory: false,
      size: stat.size,
      hash: null,
      mimeType: MIME[ext] || 'application/octet-stream',
      children: [],
      metanetTxid: null,
      tokenId: null,
    };
  }

  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const children: FsNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // Skip hidden files/dirs
    const childPath = path.join(folderPath, entry.name);
    const child = await scanFolder(childPath, rootRelTo);
    children.push(child);
  }

  // Sort: directories first, then alphabetical
  children.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    name,
    path: folderPath,
    relativePath: path.relative(rootRelTo, folderPath) || '/',
    isDirectory: true,
    size: 0,
    hash: null,
    mimeType: null,
    children,
    metanetTxid: null,
    tokenId: null,
  };
}

/**
 * Recursively hash all files in a tree.
 */
export async function hashFolder(rootNode: FsNode): Promise<FsNode> {
  if (!rootNode.isDirectory) {
    const buf = await fs.readFile(rootNode.path);
    const hash = createHash('sha256').update(buf).digest('hex');
    return { ...rootNode, hash };
  }

  const hashedChildren = await Promise.all(rootNode.children.map(hashFolder));
  return { ...rootNode, children: hashedChildren };
}

/**
 * Count total files and folders in a tree.
 */
export function countNodes(node: FsNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}
