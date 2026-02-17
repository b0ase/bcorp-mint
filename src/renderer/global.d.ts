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
      inscribeStamp: (payload: { path: string; hash: string; timestamp: string }) =>
        Promise<{ txid: string }>;
      mintStampToken: (payload: { path: string; hash: string; name: string }) =>
        Promise<{ tokenId: string }>;

      // Keystore
      keystoreHasKey: () => Promise<boolean>;
      keystoreSaveKey: (wif: string) => Promise<void>;
      keystoreDeleteKey: () => Promise<void>;
    };
  }
}
