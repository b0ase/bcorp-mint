import type { StampReceipt, WalletState } from './lib/types';

export {};

declare global {
  interface Window {
    mint: {
      loadNpgxMedia: () => Promise<string[]>;
      getSplashVideo: () => Promise<string>;
      selectFolder: () => Promise<{ folder: string; files: string[] } | null>;
      openImages: () => Promise<string[] | null>;
      openLogo: () => Promise<string | null>;
      chooseExportFolder: () => Promise<string | null>;
      saveFile: (dataUrl: string, defaultDir?: string, defaultName?: string) => Promise<string | null>;
      fetchAsDataUrl: (url: string) => Promise<{ dataUrl: string; mime: string }>;
      inscribeOrdinal: (payload: {
        dataB64: string;
        contentType: string;
        map?: Record<string, string>;
        destinationAddress?: string;
      }) => Promise<{ txid: string; ordinalId: string }>;

      // Marketplace ops — 1sat market protocol via js-1sat-ord
      marketCreateListing: (payload: {
        ordinalTxid: string;
        ordinalVout: number;
        priceSats: number;
        payAddress?: string;
      }) => Promise<{ listingTxid: string; listingVout: number; priceSats: number }>;
      marketCancelListing: (payload: {
        listingTxid: string;
        listingVout: number;
      }) => Promise<{ txid: string }>;
      marketPurchaseListing: (payload: {
        listingTxid: string;
        listingVout: number;
      }) => Promise<{ txid: string; ordinalId: string }>;
      marketMyListings: () => Promise<Array<{
        listingTxid: string;
        listingVout: number;
        ordinalTxid: string;
        ordinalVout: number;
        priceSats: number;
        createdAt?: string;
        title?: string;
      }>>;
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
      extractThumbnail: (filePath: string) => Promise<{ width: number; height: number; dataUrl: string }>;
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

      // HD master key
      keystoreHasMaster: () => Promise<boolean>;
      keystoreSetupMaster: (importHex?: string) => Promise<{ address: string; publicKey: string }>;
      keystoreGetMasterInfo: () => Promise<{ address: string; publicKey: string }>;
      keystoreDeriveAddress: (protocol: string, slug: string) => Promise<{
        protocol: string;
        slug: string;
        address: string;
        publicKey: string;
      }>;
      keystoreExportBackup: (password: string) => Promise<string>;
      keystoreImportBackup: (data: string, password: string) => Promise<{ address: string; publicKey: string }>;
      keystoreBuildManifest: (derivations: Array<{ protocol: string; slug: string }>) => Promise<{
        version: 1;
        protocol: string;
        masterAddress: string;
        masterPublicKey: string;
        children: Array<{ protocol: string; slug: string; address: string; publicKey: string }>;
        exportedAt: string;
      }>;
      keystoreDeleteMaster: () => Promise<void>;

      // Wallet manager (provider selection)
      walletListProviders: () => Promise<Array<{
        type: 'local' | 'handcash' | 'metanet';
        available: boolean;
        label: string;
      }>>;
      walletSwitchProvider: (type: string) => Promise<{
        type: 'local' | 'handcash' | 'metanet';
        connected: boolean;
        address: string | null;
        publicKey: string | null;
        balance: number | null;
        handle: string | null;
      }>;

      // Inscription helpers
      inscribeDocumentHash: (payload: {
        hashes: Array<{ file: string; sha256: string }>;
        provider: 'local' | 'handcash' | 'metanet';
        derivation?: { protocol: string; slug: string };
      }) => Promise<{ txid: string }>;
      inscribeBitTrust: (payload: {
        contentHash: string;
        tier: number;
        title: string;
        filing?: string;
        identityRef?: string;
        provider: 'local' | 'handcash' | 'metanet';
        derivation?: { protocol: string; slug: string };
      }) => Promise<{ txid: string }>;

      // Tokenise / MetaNet tree
      scanFolderTokenise: (folderPath: string) => Promise<{
        name: string;
        path: string;
        relativePath: string;
        isDirectory: boolean;
        size: number;
        hash: string | null;
        mimeType: string | null;
        children: unknown[];
        metanetTxid: string | null;
        tokenId: string | null;
      }>;
      tokeniseEstimate: (folderPath: string) => Promise<{ nodes: number; estimatedSats: number }>;
      tokeniseFolder: (payload: {
        folderPath: string;
        stampPath: string;
        conditions?: Record<string, { condition: string; conditionData: string }>;
      }) => Promise<{
        root: { txid: string };
        totalNodes: number;
        totalCost: number;
        nodes: unknown[];
      }>;
      onMetanetProgress: (callback: (data: {
        stage: string;
        completed: number;
        total: number;
        currentPath?: string;
      }) => void) => () => void;

      // Mint documents
      listMintDocuments: () => Promise<{ id: string; name: string; filePath: string; updatedAt: string }[]>;
      saveMintDocument: (docJson: string) => Promise<string>;
      loadMintDocument: (filePath: string) => Promise<string>;
      deleteMintDocument: (filePath: string) => Promise<void>;
      exportMintPng: (payload: { dataUrl: string; defaultName?: string }) => Promise<string | null>;
      exportMintSvg: (payload: { svgContent: string; defaultName?: string }) => Promise<string | null>;
      exportMintBatch: (payload: { folder: string; dataUrls: { name: string; dataUrl: string }[] }) => Promise<string[]>;

      // --- BTMS ---
      btmsStatus: () => Promise<{
        walletReady: boolean;
        networkPreset: string;
        identityKey: string | null;
        reason?: string;
      }>;
      btmsIssue: (payload: {
        amount: number;
        metadata?: {
          name?: string;
          description?: string;
          iconURL?: string;
          asset_class?: 'stock' | 'bond' | 'token' | 'currency';
          kyc_certificate?: string;
          kyc_certificate_signature?: string;
          [key: string]: unknown;
        };
      }) => Promise<{
        success: boolean;
        txid: string;
        assetId: string;
        outputIndex: number;
        amount: number;
        error?: string;
      }>;
      btmsListAssets: () => Promise<Array<{
        assetId: string;
        name?: string;
        balance: number;
        metadata?: Record<string, unknown>;
        hasPendingIncoming?: boolean;
      }>>;
      btmsGetBalance: (assetId: string) => Promise<number>;
      btmsSend: (payload: { assetId: string; recipient: string; amount: number }) => Promise<{
        success: boolean;
        txid: string;
        changeAmount?: number;
        error?: string;
      }>;
      btmsListIncoming: () => Promise<Array<Record<string, unknown>>>;
      btmsAccept: (payment: unknown) => Promise<{
        success: boolean;
        assetId: string;
        amount: number;
        error?: string;
      }>;
      btmsBurn: (payload: { assetId: string; amount?: number }) => Promise<{
        success: boolean;
        txid: string;
        assetId: string;
        amountBurned: number;
        error?: string;
      }>;

      // --- KYC ---
      kycStart: (payload: { subjectAddress: string; email?: string }) => Promise<{
        veriffSessionId: string;
        sessionUrl: string;
        subjectAddress: string;
        vendorData: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
      kycSession: () => Promise<{
        veriffSessionId: string;
        sessionUrl: string;
        subjectAddress: string;
        status: string;
      } | null>;
      kycCertificate: () => Promise<{
        certificate: {
          type: 'BRC-KYC-Certificate';
          version: '1.0';
          issuer: string;
          issuerPublicKey: string;
          issuerAddress: string;
          subject: string;
          kycProvider: string;
          kycLevel: string;
          status: 'verified';
          verifiedAt: string;
          protocolID: [number, string];
          keyID: string;
          issuedAt: string;
        };
        signature: string;
        publicKey: string;
        savedAt: string;
      } | null>;
      kycPoll: (sessionId: string) => Promise<{
        status: string;
        certificate?: {
          certificate: Record<string, unknown>;
          signature: string;
          publicKey: string;
        };
      }>;
      kycVerifyCert: (payload: { certificate: string; signature: string }) => Promise<{
        valid: boolean;
        certificate?: Record<string, unknown>;
        error?: string;
      }>;
      kycReset: () => Promise<boolean>;
    };
  }
}
