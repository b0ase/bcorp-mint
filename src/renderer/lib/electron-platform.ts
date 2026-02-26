import type { MintPlatform, FileHandle, PlatformFeature, MasterKeyInfo, DerivedChild, WalletManifest } from '@shared/lib/platform';
import type { StampReceipt, WalletState, WalletProviderType } from '@shared/lib/types';

declare global {
  interface Window {
    mint: Record<string, (...args: unknown[]) => unknown>;
  }
}

const m = () => window.mint;

function pathHandle(filePath: string, name?: string): FileHandle {
  return { type: 'path', path: filePath, name: name || filePath.split(/[\\/]/).pop() || filePath };
}

export const electronPlatform: MintPlatform = {
  isDesktop: true,
  supportedFeatures: new Set<PlatformFeature>([
    'comfyui', 'ffmpeg', 'folder-access', 'video-extraction',
    'audio-extraction', 'audio-peaks', 'waveform-generation',
    'batch-hash', 'metanet', 'document-hash', 'legacy-keystore',
    'issue-management', 'folder-export', 'batch-export',
  ]),

  // --- File operations ---

  async pickFiles(opts) {
    const result = await m().openImages() as string[] | null;
    if (!result) return [];
    return Promise.all(result.map(async (p) => {
      const name = await m().basename(p) as string;
      return pathHandle(p, name);
    }));
  },

  async pickLogo() {
    const filePath = await m().openLogo() as string | null;
    if (!filePath) return null;
    const name = await m().basename(filePath) as string;
    return pathHandle(filePath, name);
  },

  async getFileUrl(handle) {
    if (handle.type === 'path') return m().fileUrl(handle.path) as Promise<string>;
    return URL.createObjectURL(handle.file);
  },

  getFileName(handle) {
    return handle.name;
  },

  // --- Hashing ---

  async hashFile(handle) {
    if (handle.type === 'path') return m().hashFile(handle.path) as Promise<{ hash: string; size: number }>;
    // Fallback for File objects (shouldn't happen in Electron)
    const buffer = await handle.file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return { hash, size: handle.file.size };
  },

  // --- Stamp receipts ---

  async saveStampReceipt(json) {
    await m().saveStampReceipt(json);
  },
  async updateStampReceipt(id, patch) {
    await m().updateStampReceipt(id, patch);
  },
  async listStampReceipts() {
    return m().listStampReceipts() as Promise<StampReceipt[]>;
  },

  // --- Mint documents ---

  async saveMintDocument(json) {
    await m().saveMintDocument(json);
  },
  async loadMintDocument(id) {
    return m().loadMintDocument(id) as Promise<string>;
  },
  async listMintDocuments() {
    return m().listMintDocuments() as Promise<{ id: string; name: string; filePath: string; updatedAt: string }[]>;
  },
  async deleteMintDocument(id) {
    await m().deleteMintDocument(id);
  },

  // --- Export ---

  async exportPng(opts) {
    return m().exportMintPng(opts) as Promise<string>;
  },
  async exportSvg(opts) {
    await m().exportMintSvg(opts);
  },

  // --- Keystore ---

  async keystoreHasMaster() {
    return m().keystoreHasMaster() as Promise<boolean>;
  },
  async keystoreSetupMaster(importHex?) {
    return m().keystoreSetupMaster(importHex) as Promise<MasterKeyInfo>;
  },
  async keystoreGetMasterInfo() {
    return m().keystoreGetMasterInfo() as Promise<MasterKeyInfo>;
  },
  async keystoreDeriveAddress(protocol, slug) {
    return m().keystoreDeriveAddress(protocol, slug) as Promise<DerivedChild>;
  },
  async keystoreExportBackup(password) {
    return m().keystoreExportBackup(password) as Promise<string>;
  },
  async keystoreImportBackup(data, password) {
    return m().keystoreImportBackup(data, password) as Promise<MasterKeyInfo>;
  },
  async keystoreBuildManifest(derivations) {
    return m().keystoreBuildManifest(derivations) as Promise<WalletManifest>;
  },
  async keystoreDeleteMaster() {
    await m().keystoreDeleteMaster();
  },

  // Legacy keystore
  async keystoreHasKey() {
    return m().keystoreHasKey() as Promise<boolean>;
  },

  // --- Wallet ---

  async walletConnect() {
    return m().walletConnect() as Promise<WalletState>;
  },
  async walletStatus() {
    return m().walletStatus() as Promise<WalletState>;
  },
  async walletDisconnect() {
    await m().walletDisconnect();
  },
  async walletListProviders() {
    return m().walletListProviders() as Promise<Array<{ type: WalletProviderType; available: boolean; label: string }>>;
  },
  async walletSwitchProvider(type) {
    return m().walletSwitchProvider(type) as Promise<WalletState>;
  },

  // --- Inscription ---

  async inscribeStamp(opts) {
    return m().inscribeStamp(opts) as Promise<{ txid: string }>;
  },
  async mintStampToken(opts) {
    return m().mintStampToken(opts) as Promise<{ tokenId: string }>;
  },
  async batchMintTokens(pieces) {
    await m().batchMintTokens(pieces);
  },

  // --- Desktop-only ---

  async selectFolder() {
    return m().selectFolder() as Promise<{ folder: string; files: string[] } | null>;
  },
  async chooseExportFolder() {
    return m().chooseExportFolder() as Promise<string | null>;
  },
  async fileUrl(filePath) {
    return m().fileUrl(filePath) as Promise<string>;
  },
  async basename(filePath) {
    return m().basename(filePath) as Promise<string>;
  },
  async probeMedia(filePath) {
    return m().probeMedia(filePath) as Promise<{ duration: number; fps?: number; sampleRate?: number; channels?: number }>;
  },
  async extractVideoFrames(payload) {
    return m().extractVideoFrames(payload) as Promise<Array<{ path: string; width: number; height: number; timestamp: number }>>;
  },
  async extractAudioSegment(payload) {
    await m().extractAudioSegment(payload);
  },
  async getAudioPeaks(filePath, numSamples) {
    return m().getAudioPeaks(filePath, numSamples) as Promise<number[]>;
  },
  async generateWaveform(payload) {
    await m().generateWaveform(payload);
  },
  async comfyCheck() {
    return m().comfyCheck() as Promise<boolean>;
  },
  async comfyListModels() {
    return m().comfyListModels() as Promise<string[]>;
  },
  async comfyAnimate(imagePath, outputDir, opts) {
    return m().comfyAnimate(imagePath, outputDir, opts) as Promise<{ videoPath: string }>;
  },
  onComfyProgress(callback) {
    return m().onComfyProgress(callback) as () => void;
  },
  async hashFilesBatch(filePaths) {
    return m().hashFilesBatch(filePaths) as Promise<Array<{ hash: string; size: number }>>;
  },
  async nextIssueNumber(parentDir) {
    return m().nextIssueNumber(parentDir) as Promise<number>;
  },
  async createIssue(parentDir, issueNum, coverPath, bodyPaths) {
    await m().createIssue(parentDir, issueNum, coverPath, bodyPaths);
  },
  async exportMintBatch(payload) {
    await m().exportMintBatch(payload);
  },
  async inscribeDocumentHash(payload) {
    await m().inscribeDocumentHash(payload);
  },
};
