import type { StampReceipt, WalletState } from './lib/types';

export {};

declare global {
  interface Window {
    npg: {
      selectFolder: () => Promise<{ folder: string; files: string[] } | null>;
      openImages: () => Promise<string[] | null>;
      openLogo: () => Promise<string | null>;
      chooseExportFolder: () => Promise<string | null>;
      saveFile: (dataUrl: string, defaultDir?: string, defaultName?: string) => Promise<string | null>;
      writeFile: (dataUrl: string, folder: string, fileName: string) => Promise<string>;
      fileUrl: (filePath: string) => Promise<string>;
      basename: (filePath: string) => Promise<string>;
      getEditionsDir: () => Promise<string>;
      listEditions: () => Promise<{ id: string; name: string; filePath: string; updatedAt: string }[]>;
      saveEdition: (editionJson: string) => Promise<string>;
      loadEdition: (filePath: string) => Promise<string>;
      nextIssueNumber: (parentDir: string) => Promise<number>;
      createIssue: (parentDir: string, issueNum: number, coverPath: string, bodyPaths: string[]) =>
        Promise<{ issueDir: string; coverDest: string; bodyDests: string[] }>;
      comfyCheck: () => Promise<boolean>;
      comfyListModels: () => Promise<string[]>;
      comfyAnimate: (imagePath: string, outputDir: string, options?: {
        frames?: number;
        fps?: number;
        motionStrength?: number;
        modelName?: string;
      }) => Promise<{ videoPath: string; filename: string }>;
      onComfyProgress: (callback: (data: { stage: string; percent: number; elapsed: number; detail?: string }) => void) => () => void;

      // Media extraction
      probeMedia: (filePath: string) => Promise<{
        duration: number;
        width: number;
        height: number;
        fps: number;
        sampleRate: number;
        channels: number;
        codec: string;
        hasVideo: boolean;
        hasAudio: boolean;
      }>;
      extractVideoFrames: (payload: {
        filePath: string;
        outputDir?: string;
        interval?: number;
        maxFrames?: number;
        quality?: 'low' | 'medium' | 'high';
      }) => Promise<{
        frames: Array<{ path: string; index: number; timestamp: number }>;
        outputDir: string;
      }>;
      extractAudioSegment: (payload: {
        filePath: string;
        outputPath: string;
        startTime: number;
        endTime: number;
      }) => Promise<string>;
      getAudioPeaks: (filePath: string, numSamples?: number) => Promise<number[]>;
      generateWaveform: (payload: {
        filePath: string;
        outputPath: string;
        width?: number;
        height?: number;
        color?: string;
      }) => Promise<string>;
      cleanupExtraction: (dir: string) => Promise<void>;
      onExtractionProgress: (callback: (data: { completed: number; total: number; stage: string }) => void) => () => void;

      // Hashing
      hashFile: (filePath: string) => Promise<{ hash: string; size: number }>;
      hashFilesBatch: (filePaths: string[]) => Promise<{ filePath: string; hash: string; size: number }[]>;

      // Stamp receipts
      saveStampReceipt: (receiptJson: string) => Promise<string>;
      listStampReceipts: () => Promise<StampReceipt[]>;
      updateStampReceipt: (id: string, patch: Record<string, unknown>) => Promise<StampReceipt>;

      // Wallet
      walletConnect: () => Promise<WalletState>;
      walletStatus: () => Promise<WalletState>;
      walletDisconnect: () => Promise<void>;

      // Blockchain
      inscribeStamp: (payload: {
        path: string;
        hash: string;
        timestamp: string;
        parentHash?: string;
        pieceIndex?: number;
        totalPieces?: number;
      }) => Promise<{ txid: string }>;
      mintStampToken: (payload: {
        path: string;
        hash: string;
        name: string;
        iconDataB64?: string;
        iconContentType?: string;
      }) => Promise<{ tokenId: string }>;
      batchMintTokens: (pieces: Array<{
        path: string;
        hash: string;
        name: string;
        iconDataB64?: string;
        iconContentType?: string;
      }>) => Promise<Array<{ tokenId: string; txid: string; index: number }>>;
      onMintProgress: (callback: (data: { completed: number; total: number; stage: string }) => void) => () => void;

      // Keystore
      keystoreHasKey: () => Promise<boolean>;
      keystoreSaveKey: (wif: string) => Promise<void>;
      keystoreDeleteKey: () => Promise<void>;

      // Mint documents
      listMintDocuments: () => Promise<{ id: string; name: string; filePath: string; updatedAt: string }[]>;
      saveMintDocument: (docJson: string) => Promise<string>;
      loadMintDocument: (filePath: string) => Promise<string>;
      deleteMintDocument: (filePath: string) => Promise<void>;
      exportMintPng: (payload: { dataUrl: string; defaultName?: string }) => Promise<string | null>;
      exportMintSvg: (payload: { svgContent: string; defaultName?: string }) => Promise<string | null>;
      exportMintBatch: (payload: { folder: string; dataUrls: { name: string; dataUrl: string }[] }) => Promise<string[]>;
    };
  }
}
