import { app, BrowserWindow, dialog, ipcMain, shell, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hasPrivateKey, savePrivateKey, loadPrivateKey, deletePrivateKey, hasMasterKey, saveMasterKey, loadMasterKey, deleteMasterKey, migrateLegacyKey, exportMasterKeyBackup, importMasterKeyBackup } from './keystore';
import { inscribeStamp, inscribeDocumentHash } from './bsv';
import { getRedirectUrl, getWalletState, disconnect as walletDisconnect } from './handcash';
import { mintStampToken, batchMintTokens } from './token-mint';
import { generateMasterKey, deriveChildInfo, getMasterKeyInfo, buildManifest } from './wallet-derivation';
import { WalletManager } from './wallet-manager';
import type { WalletProviderType } from './wallet-provider';
import { estimateTreeCost, buildMetaNetTree, createRootNode, createChildNode } from './metanet';
import { scanFolder as scanFolderForTokenise, hashFolder, countNodes as countFsNodes } from './fs-tokenise';

const walletManager = new WalletManager();
import { probeMedia, extractVideoFrames, extractAudioSegment, getAudioPeaks, generateWaveformImage, cleanupTempDir, registerCleanupOnQuit } from './media-extract';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// Must be called BEFORE app.ready — allows renderer to load from mint-media:// URLs
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mint-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
]);

const SUPPORTED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp',
  '.mp4', '.mov', '.webm', '.avi',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'
]);

const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.avi']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']);

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4'
};

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.cjs');

  const win = new BrowserWindow({
    title: 'The Bitcoin Corporation Mint',
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#030303',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL;
    if (url) {
      win.loadURL(url);
    } else {
      win.loadURL('http://localhost:5173');
    }
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Register custom protocol for streaming local media files (used for video playback)
  protocol.handle('mint-media', async (request) => {
    try {
      const url = new URL(request.url);
      const filePath = url.searchParams.get('path');
      if (!filePath) return new Response('Missing path', { status: 400 });
      const fileUrl = pathToFileURL(filePath).href;
      const response = await net.fetch(fileUrl);
      // Add CORS headers so renderer can access from any origin (dev server, file://)
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      console.error('[mint-media] protocol error:', err);
      return new Response('File not found', { status: 404 });
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Register temp directory cleanup on quit (privacy)
registerCleanupOnQuit();

// --------------- IPC handlers ---------------

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;

  const folder = result.filePaths[0];
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => path.join(folder, e.name))
    .filter((f) => SUPPORTED_EXT.has(path.extname(f).toLowerCase()));

  return { folder, files };
});

ipcMain.handle('open-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'mp4', 'mov', 'webm', 'avi', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp'] },
      { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'avi'] },
      { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths;
});

ipcMain.handle('open-logo', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('choose-export-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-file', async (_e, payload: { dataUrl: string; defaultDir?: string; defaultName?: string }) => {
  const defaultPath =
    payload.defaultDir && payload.defaultName
      ? path.join(payload.defaultDir, payload.defaultName)
      : undefined;

  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const match = payload.dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid data URL');
  await fs.writeFile(result.filePath, Buffer.from(match[2], 'base64'));
  return result.filePath;
});

ipcMain.handle('write-file', async (_e, payload: { dataUrl: string; folder: string; fileName: string }) => {
  const outPath = path.join(payload.folder, payload.fileName);
  const match = payload.dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid data URL');
  await fs.writeFile(outPath, Buffer.from(match[2], 'base64'));
  return outPath;
});

// Read a local file and return a data: URL the renderer can use directly
ipcMain.handle('file-url', async (_e, filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = await fs.readFile(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
});

ipcMain.handle('basename', (_e, filePath: string) => path.basename(filePath));

// --------------- Edition handlers ---------------

const getEditionsDir = () => {
  const dir = path.join(app.getPath('userData'), 'editions');
  return dir;
};

ipcMain.handle('get-editions-dir', async () => {
  const dir = getEditionsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
});

ipcMain.handle('list-editions', async () => {
  const dir = getEditionsDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: { id: string; name: string; filePath: string; updatedAt: string }[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      results.push({
        id: data.id,
        name: data.name,
        filePath,
        updatedAt: data.updatedAt
      });
    } catch {
      // skip corrupt files
    }
  }

  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return results;
});

ipcMain.handle('save-edition', async (_e, editionJson: string) => {
  const dir = getEditionsDir();
  await fs.mkdir(dir, { recursive: true });
  const data = JSON.parse(editionJson);
  const filePath = path.join(dir, `${data.id}.json`);
  await fs.writeFile(filePath, editionJson, 'utf-8');
  return filePath;
});

ipcMain.handle('load-edition', async (_e, filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return raw;
});

// --------------- Issue maker handlers ---------------

ipcMain.handle('next-issue-number', async (_e, parentDir: string) => {
  const entries = await fs.readdir(parentDir, { withFileTypes: true });
  let max = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^mint-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
});

ipcMain.handle('create-issue', async (_e, payload: {
  parentDir: string;
  issueNum: number;
  coverPath: string;
  bodyPaths: string[];
}) => {
  const padded = String(payload.issueNum).padStart(3, '0');
  const issueDir = path.join(payload.parentDir, `mint-${padded}`);
  await fs.mkdir(issueDir, { recursive: true });

  // Copy cover
  const coverExt = path.extname(payload.coverPath);
  const coverDest = path.join(issueDir, `cover${coverExt}`);
  await fs.copyFile(payload.coverPath, coverDest);

  // Copy body images with sequential naming
  const bodyDests: string[] = [];
  for (let i = 0; i < payload.bodyPaths.length; i++) {
    const ext = path.extname(payload.bodyPaths[i]);
    const dest = path.join(issueDir, `${String(i + 1).padStart(3, '0')}${ext}`);
    await fs.copyFile(payload.bodyPaths[i], dest);
    bodyDests.push(dest);
  }

  return { issueDir, coverDest, bodyDests };
});

// --------------- Hashing handlers ---------------

ipcMain.handle('hash-file', async (_e, filePath: string) => {
  const buf = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const stat = await fs.stat(filePath);
  return { hash, size: stat.size };
});

ipcMain.handle('hash-files-batch', async (_e, filePaths: string[]) => {
  const results: { filePath: string; hash: string; size: number }[] = [];
  for (const filePath of filePaths) {
    const buf = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const stat = await fs.stat(filePath);
    results.push({ filePath, hash, size: stat.size });
  }
  return results;
});

// --------------- Stamp receipt handlers ---------------

const getStampsDir = () => path.join(app.getPath('userData'), 'stamps');

ipcMain.handle('save-stamp-receipt', async (_e, receiptJson: string) => {
  const dir = getStampsDir();
  await fs.mkdir(dir, { recursive: true });
  const receipt = JSON.parse(receiptJson);
  const filePath = path.join(dir, `${receipt.id}.stamp.json`);
  await fs.writeFile(filePath, receiptJson, 'utf-8');
  return filePath;
});

ipcMain.handle('list-stamp-receipts', async () => {
  const dir = getStampsDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const receipts: unknown[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.stamp.json')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, entry.name), 'utf-8');
      receipts.push(JSON.parse(raw));
    } catch { /* skip corrupt */ }
  }
  return receipts;
});

ipcMain.handle('update-stamp-receipt', async (_e, payload: { id: string; patch: Record<string, unknown> }) => {
  const dir = getStampsDir();
  const filePath = path.join(dir, `${payload.id}.stamp.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const receipt = JSON.parse(raw);
  Object.assign(receipt, payload.patch);
  await fs.writeFile(filePath, JSON.stringify(receipt, null, 2), 'utf-8');
  return receipt;
});

// --------------- Wallet handlers ---------------

ipcMain.handle('wallet-connect', async () => {
  try {
    const url = await getRedirectUrl();
    await shell.openExternal(url);
    // Wait for callback (profile will be populated)
    return getWalletState();
  } catch (err) {
    console.error('[wallet-connect]', err);
    return getWalletState();
  }
});

ipcMain.handle('wallet-status', async () => getWalletState());

ipcMain.handle('wallet-disconnect', async () => {
  walletDisconnect();
});

// --------------- Blockchain handlers ---------------

ipcMain.handle('inscribe-stamp', async (_e, payload: {
  path: string;
  hash: string;
  timestamp: string;
  parentHash?: string;
  pieceIndex?: number;
  totalPieces?: number;
}) => {
  return inscribeStamp(payload);
});

ipcMain.handle('inscribe-document-hash', async (_e, payload: {
  hashes: Array<{ file: string; sha256: string }>;
  provider: 'local' | 'handcash';
}) => {
  return inscribeDocumentHash(payload);
});

ipcMain.handle('mint-stamp-token', async (_e, payload: {
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
}) => {
  return mintStampToken(payload);
});

ipcMain.handle('batch-mint-tokens', async (_e, pieces: Array<{
  path: string;
  hash: string;
  name: string;
  iconDataB64?: string;
  iconContentType?: string;
}>) => {
  return batchMintTokens(pieces);
});

// --------------- Media extraction handlers ---------------

ipcMain.handle('probe-media', async (_e, filePath: string) => {
  return probeMedia(filePath);
});

ipcMain.handle('extract-video-frames', async (_e, payload: {
  filePath: string;
  outputDir?: string;
  interval?: number;
  maxFrames?: number;
  quality?: 'low' | 'medium' | 'high';
}) => {
  return extractVideoFrames(payload.filePath, payload.outputDir || '', {
    interval: payload.interval,
    maxFrames: payload.maxFrames,
    quality: payload.quality
  });
});

ipcMain.handle('extract-audio-segment', async (_e, payload: {
  filePath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
}) => {
  return extractAudioSegment(payload.filePath, payload.outputPath, payload.startTime, payload.endTime);
});

ipcMain.handle('get-audio-peaks', async (_e, payload: { filePath: string; numSamples?: number }) => {
  return getAudioPeaks(payload.filePath, payload.numSamples);
});

ipcMain.handle('generate-waveform', async (_e, payload: {
  filePath: string;
  outputPath: string;
  width?: number;
  height?: number;
  color?: string;
}) => {
  return generateWaveformImage(payload.filePath, payload.outputPath, {
    width: payload.width,
    height: payload.height,
    color: payload.color
  });
});

ipcMain.handle('cleanup-extraction', async (_e, dir: string) => {
  return cleanupTempDir(dir);
});

// --------------- Keystore handlers ---------------

ipcMain.handle('keystore-has-key', async () => hasPrivateKey());
ipcMain.handle('keystore-save-key', async (_e, wif: string) => savePrivateKey(wif));
ipcMain.handle('keystore-delete-key', async () => deletePrivateKey());

// --------------- Master key / HD wallet handlers ---------------

ipcMain.handle('keystore-has-master', async () => hasMasterKey());

ipcMain.handle('keystore-setup-master', async (_e, payload?: { importHex?: string }) => {
  if (payload?.importHex) {
    await saveMasterKey(payload.importHex);
  } else {
    // Try migration first, then generate new
    const migrated = await migrateLegacyKey();
    if (!migrated) {
      const hex = generateMasterKey();
      await saveMasterKey(hex);
    }
  }
  const masterHex = await loadMasterKey();
  return getMasterKeyInfo(masterHex);
});

ipcMain.handle('keystore-get-master-info', async () => {
  if (!(await hasMasterKey())) return null;
  const masterHex = await loadMasterKey();
  return getMasterKeyInfo(masterHex);
});

ipcMain.handle('keystore-derive-address', async (_e, payload: { protocol: string; slug: string }) => {
  const masterHex = await loadMasterKey();
  return deriveChildInfo(masterHex, payload.protocol, payload.slug);
});

ipcMain.handle('keystore-export-backup', async (_e, password: string) => {
  return exportMasterKeyBackup(password);
});

ipcMain.handle('keystore-import-backup', async (_e, payload: { data: string; password: string }) => {
  const hex = importMasterKeyBackup(payload.data, payload.password);
  await saveMasterKey(hex);
  return getMasterKeyInfo(hex);
});

ipcMain.handle('keystore-build-manifest', async (_e, children: Array<{ protocol: string; slug: string }>) => {
  const masterHex = await loadMasterKey();
  return buildManifest(masterHex, children);
});

ipcMain.handle('keystore-delete-master', async () => {
  await deleteMasterKey();
});

// --------------- Wallet manager handlers ---------------

ipcMain.handle('wallet-list-providers', async () => {
  return walletManager.detectAvailableProviders();
});

ipcMain.handle('wallet-switch-provider', async (_e, type: WalletProviderType) => {
  return walletManager.switchProvider(type);
});

ipcMain.handle('wallet-get-status', async () => {
  return walletManager.getStatus();
});

// --------------- MetaNet handlers ---------------

ipcMain.handle('metanet-estimate', async (_e, folderPath: string) => {
  return estimateTreeCost(folderPath);
});

ipcMain.handle('metanet-create-tree', async (_e, payload: {
  folderPath: string;
  stampPath: string;
  conditions?: Record<string, { condition: string; conditionData: string }>;
}) => {
  const masterHex = await loadMasterKey();
  const conditionsMap = payload.conditions
    ? new Map(Object.entries(payload.conditions))
    : undefined;
  return buildMetaNetTree(masterHex, payload.folderPath, payload.stampPath, conditionsMap);
});

// --------------- File tokenisation handlers ---------------

ipcMain.handle('scan-folder-tokenise', async (_e, folderPath: string) => {
  // No SUPPORTED_EXT filter — accepts ALL file types for tokenisation
  return scanFolderForTokenise(folderPath);
});

ipcMain.handle('tokenise-estimate', async (_e, folderPath: string) => {
  const root = await scanFolderForTokenise(folderPath);
  const nodeCount = countFsNodes(root);
  return { nodes: nodeCount, estimatedSats: nodeCount * 500 };
});

ipcMain.handle('tokenise-folder', async (_e, payload: {
  folderPath: string;
  stampPath: string;
  conditions?: Record<string, { condition: string; conditionData: string }>;
}) => {
  // Hash all files first, then create MetaNet tree
  const root = await scanFolderForTokenise(payload.folderPath);
  const hashed = await hashFolder(root);
  // MetaNet tree creation is handled by the metanet-create-tree handler
  const masterHex = await loadMasterKey();
  const conditionsMap = payload.conditions
    ? new Map(Object.entries(payload.conditions))
    : undefined;
  return buildMetaNetTree(masterHex, payload.folderPath, payload.stampPath, conditionsMap);
});

ipcMain.handle('metanet-create-node', async (_e, payload: {
  parentTxid: string;
  parentPath: string;
  segment: string;
  filePath?: string;
  condition?: string;
  conditionData?: string;
}) => {
  const masterHex = await loadMasterKey();
  const parentNode = {
    txid: payload.parentTxid,
    path: payload.parentPath,
    segment: '',
    isDirectory: true,
    publicKey: '',
    address: '',
    parentTxid: '',
    contentHash: null,
    contentType: null,
    condition: '',
    conditionData: '',
  };
  return createChildNode(
    masterHex,
    parentNode,
    payload.segment,
    payload.filePath ? { filePath: payload.filePath } : undefined,
    payload.condition || '',
    payload.conditionData || '',
  );
});

// --------------- Mint document handlers ---------------

const getMintDocsDir = () => path.join(app.getPath('userData'), 'mint-documents');

ipcMain.handle('list-mint-documents', async () => {
  const dir = getMintDocsDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: { id: string; name: string; filePath: string; updatedAt: string }[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mint.json')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, entry.name), 'utf-8');
      const data = JSON.parse(raw);
      results.push({ id: data.id, name: data.name, filePath: path.join(dir, entry.name), updatedAt: data.updatedAt });
    } catch { /* skip corrupt */ }
  }
  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return results;
});

ipcMain.handle('save-mint-document', async (_e, docJson: string) => {
  const dir = getMintDocsDir();
  await fs.mkdir(dir, { recursive: true });
  const data = JSON.parse(docJson);
  const filePath = path.join(dir, `${data.id}.mint.json`);
  await fs.writeFile(filePath, docJson, 'utf-8');
  return filePath;
});

ipcMain.handle('load-mint-document', async (_e, filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return raw;
});

ipcMain.handle('delete-mint-document', async (_e, filePath: string) => {
  await fs.unlink(filePath);
});

ipcMain.handle('export-mint-png', async (_e, payload: { dataUrl: string; defaultName?: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.defaultName,
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
    ]
  });
  if (result.canceled || !result.filePath) return null;
  const match = payload.dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid data URL');
  await fs.writeFile(result.filePath, Buffer.from(match[2], 'base64'));
  return result.filePath;
});

ipcMain.handle('export-mint-svg', async (_e, payload: { svgContent: string; defaultName?: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.defaultName,
    filters: [{ name: 'SVG Image', extensions: ['svg'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, payload.svgContent, 'utf-8');
  return result.filePath;
});

ipcMain.handle('export-mint-batch', async (_e, payload: { folder: string; dataUrls: { name: string; dataUrl: string }[] }) => {
  await fs.mkdir(payload.folder, { recursive: true });
  const results: string[] = [];
  for (const item of payload.dataUrls) {
    const match = item.dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) continue;
    const filePath = path.join(payload.folder, item.name);
    await fs.writeFile(filePath, Buffer.from(match[2], 'base64'));
    results.push(filePath);
  }
  return results;
});

// --------------- ComfyUI integration ---------------

const COMFY_HOST = '127.0.0.1';
const COMFY_PORT = 8188;

function comfyFetch(urlPath: string, options: { method?: string; body?: Buffer | string; headers?: Record<string, string> } = {}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: COMFY_HOST, port: COMFY_PORT, path: urlPath, method: options.method || 'GET', headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Check if ComfyUI is running
ipcMain.handle('comfyui-check', async () => {
  try {
    const res = await comfyFetch('/system_stats');
    return res.status === 200;
  } catch {
    return false;
  }
});

// Track which loader each model belongs to
const unetModels = new Set<string>();
const checkpointModels = new Set<string>();

// List available video models from ComfyUI (checks both checkpoint and UNET loaders)
ipcMain.handle('comfyui-list-models', async () => {
  try {
    const models: string[] = [];
    unetModels.clear();
    checkpointModels.clear();

    // Check ImageOnlyCheckpointLoader (SVD-style models)
    try {
      const res = await comfyFetch('/object_info/ImageOnlyCheckpointLoader');
      if (res.status === 200) {
        const data = JSON.parse(res.body.toString());
        const names = data.ImageOnlyCheckpointLoader?.input?.required?.ckpt_name?.[0];
        if (Array.isArray(names)) {
          names.forEach((n: string) => checkpointModels.add(n));
          models.push(...names);
        }
      }
    } catch { /* ignore */ }

    // Check UNETLoader (Wan 2.1, etc.)
    // Filter out CLIP/encoder models (qwen, clip, text_encoder) — only include video diffusion models
    const nonVideoPatterns = /qwen|clip|text.?enc|vae|lora/i;
    try {
      const res = await comfyFetch('/object_info/UNETLoader');
      if (res.status === 200) {
        const data = JSON.parse(res.body.toString());
        const names = data.UNETLoader?.input?.required?.unet_name?.[0];
        if (Array.isArray(names)) {
          const videoModels = names.filter((n: string) => !nonVideoPatterns.test(n));
          videoModels.forEach((n: string) => unetModels.add(n));
          models.push(...videoModels);
        }
      }
    } catch { /* ignore */ }

    return models;
  } catch {
    return [];
  }
});

// Upload an image to ComfyUI and return its filename
async function comfyUploadImage(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  const boundary = '----MintBoundary' + Date.now();

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`;
  body += `Content-Type: application/octet-stream\r\n\r\n`;

  const header = Buffer.from(body, 'utf-8');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const multipart = Buffer.concat([header, fileBuffer, footer]);

  const res = await comfyFetch('/upload/image', {
    method: 'POST',
    body: multipart,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
  });

  if (res.status !== 200) throw new Error(`Upload failed: ${res.status}`);
  const data = JSON.parse(res.body.toString());
  return data.name;
}

// Detect model type: if the model came from UNETLoader it's a Wan/UNET workflow,
// if from ImageOnlyCheckpointLoader it's SVD. Fall back to filename detection.
function detectModelType(modelName: string): 'wan' | 'svd' {
  if (unetModels.has(modelName)) return 'wan';
  if (checkpointModels.has(modelName)) return 'svd';
  // Fallback to filename heuristic
  const lower = modelName.toLowerCase();
  if (lower.includes('wan') || lower.includes('qwen')) return 'wan';
  return 'svd';
}

// Build a Wan 2.1 img2vid workflow
function buildWanWorkflow(imageName: string, frames: number, fps: number, modelName: string) {
  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: { unet_name: modelName, weight_dtype: 'default' }
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan' }
    },
    '3': {
      class_type: 'CLIPVisionLoader',
      inputs: { clip_name: 'clip_vision_h.safetensors' }
    },
    '4': {
      class_type: 'VAELoader',
      inputs: { vae_name: 'wan_2.1_vae.safetensors' }
    },
    '5': {
      class_type: 'LoadImage',
      inputs: { image: imageName, upload: 'image' }
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'cinematic smooth motion, high quality animation', clip: ['2', 0] }
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'blurry, distorted, low quality, static', clip: ['2', 0] }
    },
    '8': {
      class_type: 'CLIPVisionEncode',
      inputs: { clip_vision: ['3', 0], image: ['5', 0], crop: 'center' }
    },
    '9': {
      class_type: 'WanImageToVideo',
      inputs: {
        positive: ['6', 0],
        negative: ['7', 0],
        vae: ['4', 0],
        width: 832,
        height: 480,
        length: frames,
        batch_size: 1,
        clip_vision_output: ['8', 0],
        start_image: ['5', 0]
      }
    },
    '10': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: 20,
        cfg: 3.0,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['9', 0],
        negative: ['9', 1],
        latent_image: ['9', 2]
      }
    },
    '11': {
      class_type: 'VAEDecode',
      inputs: { samples: ['10', 0], vae: ['4', 0] }
    },
    '12': {
      class_type: 'CreateVideo',
      inputs: { images: ['11', 0], fps: fps }
    },
    '13': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['12', 0],
        filename_prefix: 'mint_animate',
        format: 'mp4',
        codec: 'h264'
      }
    }
  };
}

// Build an SVD img2vid workflow (for SVD checkpoints)
function buildSvdWorkflow(imageName: string, frames: number, fps: number, motionStrength: number, modelName: string) {
  return {
    '1': {
      class_type: 'ImageOnlyCheckpointLoader',
      inputs: { ckpt_name: modelName }
    },
    '2': {
      class_type: 'LoadImage',
      inputs: { image: imageName, upload: 'image' }
    },
    '3': {
      class_type: 'SVD_img2vid_Conditioning',
      inputs: {
        width: 1024,
        height: 576,
        video_frames: frames,
        motion_bucket_id: Math.round(motionStrength * 255),
        fps: fps,
        augmentation_level: 0.0,
        clip_vision: ['1', 1],
        init_image: ['2', 0],
        vae: ['1', 2]
      }
    },
    '4': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: 20,
        cfg: 2.5,
        sampler_name: 'euler',
        scheduler: 'karras',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['3', 0],
        negative: ['3', 1],
        latent_image: ['3', 2]
      }
    },
    '5': {
      class_type: 'VAEDecode',
      inputs: { samples: ['4', 0], vae: ['1', 2] }
    },
    '6': {
      class_type: 'CreateVideo',
      inputs: { images: ['5', 0], fps: fps }
    },
    '7': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['6', 0],
        filename_prefix: 'mint_animate',
        format: 'mp4',
        codec: 'h264'
      }
    }
  };
}

// Send progress updates to the renderer
function sendAnimateProgress(stage: string, percent: number, elapsed: number, detail?: string) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('comfyui-progress', { stage, percent, elapsed, detail });
}

// Queue a prompt and wait for it to complete, return output info
async function comfyQueueAndWait(workflow: Record<string, unknown>): Promise<{ images: string[]; videos: string[] }> {
  const clientId = 'bcorp-mint-' + Date.now();
  const startTime = Date.now();

  sendAnimateProgress('Queuing prompt...', 5, 0);

  // Queue the prompt
  const promptPayload = JSON.stringify({ prompt: workflow, client_id: clientId });
  const queueRes = await comfyFetch('/prompt', {
    method: 'POST',
    body: promptPayload,
    headers: { 'Content-Type': 'application/json' }
  });

  if (queueRes.status !== 200) {
    const errText = queueRes.body.toString();
    throw new Error(`ComfyUI queue failed (${queueRes.status}): ${errText}`);
  }

  const { prompt_id } = JSON.parse(queueRes.body.toString());
  sendAnimateProgress('Loading model...', 10, 0);

  // Poll for completion
  let lastNodeCount = 0;
  for (let attempt = 0; attempt < 600; attempt++) { // up to 10 minutes
    await new Promise((r) => setTimeout(r, 1000));
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    const histRes = await comfyFetch(`/history/${prompt_id}`);
    if (histRes.status !== 200) continue;

    const history = JSON.parse(histRes.body.toString());
    const entry = history[prompt_id];
    if (!entry) {
      // Check execution progress via WebSocket-style polling
      try {
        const qRes = await comfyFetch('/queue');
        const qData = JSON.parse(qRes.body.toString());
        const running = qData.queue_running?.length ?? 0;
        const pending = qData.queue_pending?.length ?? 0;

        if (pending > 0) {
          sendAnimateProgress('Queued...', 8, elapsed, `${pending} job(s) ahead`);
        } else if (running > 0) {
          // Estimate progress based on elapsed time (typical 3-8 min range)
          const estimatedPct = Math.min(85, 15 + (elapsed / 360) * 70);
          const stage = elapsed < 30 ? 'Loading model...' : 'Generating frames...';
          sendAnimateProgress(stage, Math.round(estimatedPct), elapsed);
        }
      } catch { /* ignore */ }
      continue;
    }

    // Check for execution error
    const status = entry.status as { status_str?: string; messages?: unknown[][] } | undefined;
    if (status?.status_str === 'error') {
      const errMsg = status.messages?.find((m: unknown[]) => m[0] === 'execution_error');
      const detail = errMsg ? (errMsg[1] as { exception_message?: string })?.exception_message : 'Unknown error';
      throw new Error(`ComfyUI execution error: ${detail}`);
    }

    // Done! Collect outputs
    sendAnimateProgress('Processing output...', 90, elapsed);
    const outputs: { images: string[]; videos: string[] } = { images: [], videos: [] };
    for (const nodeOutput of Object.values(entry.outputs || {})) {
      const out = nodeOutput as Record<string, unknown[]>;
      if (out.gifs) {
        for (const gif of out.gifs as Array<{ filename: string; subfolder: string; type: string }>) {
          outputs.videos.push(gif.filename);
        }
      }
      if (out.videos) {
        for (const vid of out.videos as Array<{ filename: string; subfolder: string; type: string }>) {
          outputs.videos.push(vid.filename);
        }
      }
      if (out.images) {
        for (const img of out.images as Array<{ filename: string; subfolder: string; type: string }>) {
          outputs.images.push(img.filename);
        }
      }
    }
    return outputs;
  }

  throw new Error('ComfyUI generation timed out');
}

// Main animate handler: upload image → queue workflow → wait → save result
ipcMain.handle('comfyui-animate', async (_e, payload: {
  imagePath: string;
  outputDir: string;
  frames?: number;
  fps?: number;
  motionStrength?: number;
  modelName?: string;
}) => {
  const frames = payload.frames ?? 25;
  const fps = payload.fps ?? 8;
  const motionStrength = payload.motionStrength ?? 0.5;
  const modelName = payload.modelName ?? 'svd_xt_1_1.safetensors';

  const startTime = Date.now();

  // 1. Upload the source image
  sendAnimateProgress('Uploading image...', 2, 0);
  const uploadedName = await comfyUploadImage(payload.imagePath);

  // 2. Build and queue the workflow (pick based on model type)
  const modelType = detectModelType(modelName);
  const workflow = modelType === 'wan'
    ? buildWanWorkflow(uploadedName, frames, fps, modelName)
    : buildSvdWorkflow(uploadedName, frames, fps, motionStrength, modelName);
  const result = await comfyQueueAndWait(workflow);

  // 3. Download the output video
  const videoFile = result.videos[0];
  if (!videoFile) throw new Error('No video output from ComfyUI');

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  sendAnimateProgress('Downloading video...', 95, elapsed);

  const viewRes = await comfyFetch(`/view?filename=${encodeURIComponent(videoFile)}&type=output`);
  if (viewRes.status !== 200) throw new Error('Failed to download video from ComfyUI');

  // 4. Save to output directory
  await fs.mkdir(payload.outputDir, { recursive: true });
  const outPath = path.join(payload.outputDir, videoFile);
  await fs.writeFile(outPath, viewRes.body);

  sendAnimateProgress('Done!', 100, Math.floor((Date.now() - startTime) / 1000));
  return { videoPath: outPath, filename: videoFile };
});
