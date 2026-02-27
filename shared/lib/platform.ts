import type { StampReceipt, WalletState, WalletProviderType } from './types';

// --- FileHandle: unified reference to a file across Electron (path) and Browser (File) ---

export type FileHandle = {
  type: 'path';
  path: string;
  name: string;
} | {
  type: 'file';
  file: File;
  name: string;
};

// --- Platform feature flags ---

export type PlatformFeature =
  | 'comfyui'
  | 'ffmpeg'
  | 'folder-access'
  | 'video-extraction'
  | 'audio-extraction'
  | 'audio-peaks'
  | 'waveform-generation'
  | 'batch-hash'
  | 'metanet'
  | 'document-hash'
  | 'legacy-keystore'
  | 'issue-management'
  | 'folder-export'
  | 'batch-export';

// --- Wallet / Keystore types (returned by platform) ---

export type MasterKeyInfo = {
  address: string;
  publicKey: string;
};

export type DerivedChild = {
  protocol: string;
  slug: string;
  address: string;
  publicKey: string;
  derivationPath?: string;
};

export type WalletManifest = {
  masterAddress: string;
  children: DerivedChild[];
};

// --- MintPlatform: the contract both Electron and Browser must implement ---

export interface MintPlatform {
  // --- File operations ---
  pickFiles(opts?: { accept?: string; multiple?: boolean }): Promise<FileHandle[]>;
  pickLogo(): Promise<FileHandle | null>;
  getFileUrl(handle: FileHandle): Promise<string>;
  getFileName(handle: FileHandle): string;

  // --- Hashing ---
  hashFile(handle: FileHandle): Promise<{ hash: string; size: number }>;

  // --- Stamp receipts (CRUD) ---
  saveStampReceipt(json: string): Promise<void>;
  updateStampReceipt(id: string, patch: Record<string, unknown>): Promise<void>;
  listStampReceipts(): Promise<StampReceipt[]>;

  // --- Mint documents (CRUD) ---
  saveMintDocument(json: string): Promise<void>;
  loadMintDocument(id: string): Promise<string>;
  listMintDocuments(): Promise<{ id: string; name: string; filePath: string; updatedAt: string }[]>;
  deleteMintDocument(id: string): Promise<void>;

  // --- Export ---
  exportPng(opts: { dataUrl: string; defaultName: string }): Promise<string>;
  exportSvg?(opts: { svgContent: string; defaultName: string }): Promise<void>;

  // --- Keystore (HD wallet) ---
  keystoreHasMaster(): Promise<boolean>;
  keystoreSetupMaster(importHex?: string): Promise<MasterKeyInfo>;
  keystoreGetMasterInfo(): Promise<MasterKeyInfo>;
  keystoreDeriveAddress(protocol: string, slug: string): Promise<DerivedChild>;
  keystoreExportBackup(password: string): Promise<string>;
  keystoreImportBackup(data: string, password: string): Promise<MasterKeyInfo>;
  keystoreBuildManifest(derivations: Array<{ protocol: string; slug: string }>): Promise<WalletManifest>;
  keystoreDeleteMaster(): Promise<void>;

  // --- Legacy keystore (Electron-only, optional) ---
  keystoreHasKey?(): Promise<boolean>;

  // --- Wallet connection ---
  walletConnect(): Promise<WalletState>;
  walletStatus(): Promise<WalletState>;
  walletDisconnect(): Promise<void>;
  walletListProviders(): Promise<Array<{ type: WalletProviderType; available: boolean; label: string }>>;
  walletSwitchProvider(type: string): Promise<WalletState>;

  // --- Inscription ---
  inscribeStamp(opts: {
    path: string;
    hash: string;
    timestamp: string;
    parentHash?: string;
    pieceIndex?: number;
    totalPieces?: number;
  }): Promise<{ txid: string }>;
  mintStampToken?(opts: {
    path: string;
    hash: string;
    name: string;
    iconDataB64?: string;
    iconContentType?: string;
  }): Promise<{ tokenId: string }>;
  batchMintTokens?(pieces: Array<{
    path: string;
    hash: string;
    name: string;
    iconDataB64?: string;
    iconContentType?: string;
  }>): Promise<void>;

  // --- Message signing (optional — for ownership chain endorsements) ---
  signMessage?(message: string): Promise<{ signature: string; address: string }>;

  // --- Desktop-only (optional — undefined in browser) ---
  selectFolder?(): Promise<{ folder: string; files: string[] } | null>;
  chooseExportFolder?(): Promise<string | null>;
  fileUrl?(filePath: string): Promise<string>;
  basename?(filePath: string): Promise<string>;
  probeMedia?(filePath: string): Promise<{ duration: number; fps?: number; sampleRate?: number; channels?: number }>;
  extractVideoFrames?(payload: {
    filePath: string;
    outputDir?: string;
    interval?: number;
    maxFrames?: number;
    quality?: 'low' | 'medium' | 'high';
  }): Promise<Array<{ path: string; width: number; height: number; timestamp: number }>>;
  extractAudioSegment?(payload: {
    filePath: string;
    outputPath: string;
    startTime: number;
    endTime: number;
  }): Promise<void>;
  getAudioPeaks?(filePath: string, numSamples?: number): Promise<number[]>;
  generateWaveform?(payload: {
    filePath: string;
    outputPath: string;
    width?: number;
    height?: number;
    color?: string;
  }): Promise<void>;
  comfyCheck?(): Promise<boolean>;
  comfyListModels?(): Promise<string[]>;
  comfyAnimate?(imagePath: string, outputDir: string, opts?: {
    frames?: number;
    fps?: number;
    motionStrength?: number;
    modelName?: string;
  }): Promise<{ videoPath: string }>;
  onComfyProgress?(callback: (data: { stage: string; percent: number; elapsed: number; detail?: string }) => void): () => void;
  hashFilesBatch?(filePaths: string[]): Promise<Array<{ hash: string; size: number }>>;
  nextIssueNumber?(parentDir: string): Promise<number>;
  createIssue?(parentDir: string, issueNum: number, coverPath: string, bodyPaths: string[]): Promise<void>;
  exportMintBatch?(payload: { folder: string; dataUrls: { name: string; dataUrl: string }[] }): Promise<void>;

  // --- MetaNet (desktop-only) ---
  inscribeDocumentHash?(payload: { hashes: Array<{ file: string; sha256: string }>; provider: 'local' | 'handcash' }): Promise<void>;

  // --- Platform info ---
  isDesktop: boolean;
  supportedFeatures: Set<PlatformFeature>;
}
