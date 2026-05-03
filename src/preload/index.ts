import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mint', {
  loadNpgxMedia: () => ipcRenderer.invoke('load-npgx-media'),
  getSplashVideo: () => ipcRenderer.invoke('get-splash-video'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openImages: () => ipcRenderer.invoke('open-images'),
  openLogo: () => ipcRenderer.invoke('open-logo'),
  chooseExportFolder: () => ipcRenderer.invoke('choose-export-folder'),
  saveFile: (dataUrl: string, defaultDir?: string, defaultName?: string) =>
    ipcRenderer.invoke('save-file', { dataUrl, defaultDir, defaultName }),
  fetchAsDataUrl: (url: string) =>
    ipcRenderer.invoke('fetch-as-data-url', url) as Promise<{ dataUrl: string; mime: string }>,
  inscribeOrdinal: (payload: { dataB64: string; contentType: string; map?: Record<string, string>; destinationAddress?: string }) =>
    ipcRenderer.invoke('inscribe-ordinal', payload) as Promise<{ txid: string; ordinalId: string }>,
  writeFile: (dataUrl: string, folder: string, fileName: string) =>
    ipcRenderer.invoke('write-file', { dataUrl, folder, fileName }),
  fileUrl: (filePath: string) => ipcRenderer.invoke('file-url', filePath),
  basename: (filePath: string) => ipcRenderer.invoke('basename', filePath),
  getEditionsDir: () => ipcRenderer.invoke('get-editions-dir'),
  listEditions: () => ipcRenderer.invoke('list-editions'),
  saveEdition: (editionJson: string) => ipcRenderer.invoke('save-edition', editionJson),
  loadEdition: (filePath: string) => ipcRenderer.invoke('load-edition', filePath),
  nextIssueNumber: (parentDir: string) => ipcRenderer.invoke('next-issue-number', parentDir),
  createIssue: (parentDir: string, issueNum: number, coverPath: string, bodyPaths: string[]) =>
    ipcRenderer.invoke('create-issue', { parentDir, issueNum, coverPath, bodyPaths }),
  comfyCheck: () => ipcRenderer.invoke('comfyui-check'),
  comfyListModels: () => ipcRenderer.invoke('comfyui-list-models') as Promise<string[]>,
  comfyAnimate: (imagePath: string, outputDir: string, options?: { frames?: number; fps?: number; motionStrength?: number; modelName?: string }) =>
    ipcRenderer.invoke('comfyui-animate', { imagePath, outputDir, ...options }),
  onComfyProgress: (callback: (data: { stage: string; percent: number; elapsed: number; detail?: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { stage: string; percent: number; elapsed: number; detail?: string }) => callback(data);
    ipcRenderer.on('comfyui-progress', handler);
    return () => ipcRenderer.removeListener('comfyui-progress', handler);
  },

  // Media extraction
  probeMedia: (filePath: string) => ipcRenderer.invoke('probe-media', filePath),
  extractThumbnail: (filePath: string) => ipcRenderer.invoke('extract-thumbnail', filePath) as Promise<{ width: number; height: number; dataUrl: string }>,
  extractVideoFrames: (payload: {
    filePath: string;
    outputDir?: string;
    interval?: number;
    maxFrames?: number;
    quality?: 'low' | 'medium' | 'high';
  }) => ipcRenderer.invoke('extract-video-frames', payload),
  extractAudioSegment: (payload: {
    filePath: string;
    outputPath: string;
    startTime: number;
    endTime: number;
  }) => ipcRenderer.invoke('extract-audio-segment', payload),
  getAudioPeaks: (filePath: string, numSamples?: number) =>
    ipcRenderer.invoke('get-audio-peaks', { filePath, numSamples }),
  generateWaveform: (payload: {
    filePath: string;
    outputPath: string;
    width?: number;
    height?: number;
    color?: string;
  }) => ipcRenderer.invoke('generate-waveform', payload),
  cleanupExtraction: (dir: string) => ipcRenderer.invoke('cleanup-extraction', dir),
  onExtractionProgress: (callback: (data: { completed: number; total: number; stage: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { completed: number; total: number; stage: string }) => callback(data);
    ipcRenderer.on('extraction-progress', handler);
    return () => ipcRenderer.removeListener('extraction-progress', handler);
  },

  // Hashing
  hashFile: (filePath: string) => ipcRenderer.invoke('hash-file', filePath),
  hashFilesBatch: (filePaths: string[]) => ipcRenderer.invoke('hash-files-batch', filePaths),

  // Stamp receipts
  saveStampReceipt: (receiptJson: string) => ipcRenderer.invoke('save-stamp-receipt', receiptJson),
  listStampReceipts: () => ipcRenderer.invoke('list-stamp-receipts'),
  updateStampReceipt: (id: string, patch: Record<string, unknown>) =>
    ipcRenderer.invoke('update-stamp-receipt', { id, patch }),

  // Wallet
  walletConnect: () => ipcRenderer.invoke('wallet-connect'),
  walletStatus: () => ipcRenderer.invoke('wallet-status'),
  walletDisconnect: () => ipcRenderer.invoke('wallet-disconnect'),

  // Blockchain
  inscribeStamp: (payload: { path: string; hash: string; timestamp: string; parentHash?: string; pieceIndex?: number; totalPieces?: number }) =>
    ipcRenderer.invoke('inscribe-stamp', payload),
  mintStampToken: (payload: { path: string; hash: string; name: string; iconDataB64?: string; iconContentType?: string }) =>
    ipcRenderer.invoke('mint-stamp-token', payload),
  batchMintTokens: (pieces: Array<{ path: string; hash: string; name: string; iconDataB64?: string; iconContentType?: string }>) =>
    ipcRenderer.invoke('batch-mint-tokens', pieces),
  onMintProgress: (callback: (data: { completed: number; total: number; stage: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { completed: number; total: number; stage: string }) => callback(data);
    ipcRenderer.on('mint-progress', handler);
    return () => ipcRenderer.removeListener('mint-progress', handler);
  },

  // Keystore (legacy single-key + HD master)
  keystoreHasKey: () => ipcRenderer.invoke('keystore-has-key'),
  keystoreSaveKey: (wif: string) => ipcRenderer.invoke('keystore-save-key', wif),
  keystoreDeleteKey: () => ipcRenderer.invoke('keystore-delete-key'),
  keystoreHasMaster: () => ipcRenderer.invoke('keystore-has-master'),
  keystoreSetupMaster: (importHex?: string) =>
    ipcRenderer.invoke('keystore-setup-master', importHex),
  keystoreGetMasterInfo: () => ipcRenderer.invoke('keystore-get-master-info'),
  keystoreDeriveAddress: (protocol: string, slug: string) =>
    ipcRenderer.invoke('keystore-derive-address', protocol, slug),
  keystoreExportBackup: (password: string) =>
    ipcRenderer.invoke('keystore-export-backup', password),
  keystoreImportBackup: (data: string, password: string) =>
    ipcRenderer.invoke('keystore-import-backup', data, password),
  keystoreBuildManifest: (derivations: Array<{ protocol: string; slug: string }>) =>
    ipcRenderer.invoke('keystore-build-manifest', derivations),
  keystoreDeleteMaster: () => ipcRenderer.invoke('keystore-delete-master'),

  // Wallet manager (provider selection)
  walletListProviders: () => ipcRenderer.invoke('wallet-list-providers'),
  walletSwitchProvider: (type: string) =>
    ipcRenderer.invoke('wallet-switch-provider', type),

  // Inscription helpers
  inscribeDocumentHash: (payload: {
    hashes: Array<{ file: string; sha256: string }>;
    provider: 'local' | 'handcash' | 'metanet';
    derivation?: { protocol: string; slug: string };
  }) => ipcRenderer.invoke('inscribe-document-hash', payload),
  inscribeBitTrust: (payload: {
    contentHash: string;
    tier: number;
    title: string;
    filing?: string;
    identityRef?: string;
    provider: 'local' | 'handcash' | 'metanet';
    derivation?: { protocol: string; slug: string };
  }) => ipcRenderer.invoke('inscribe-bit-trust', payload),

  // Tokenise / MetaNet tree
  scanFolderTokenise: (folderPath: string) =>
    ipcRenderer.invoke('scan-folder-tokenise', folderPath),
  tokeniseEstimate: (folderPath: string) =>
    ipcRenderer.invoke('tokenise-estimate', folderPath),
  tokeniseFolder: (payload: {
    folderPath: string;
    stampPath: string;
    conditions?: Record<string, { condition: string; conditionData: string }>;
  }) => ipcRenderer.invoke('tokenise-folder', payload),
  onMetanetProgress: (callback: (data: {
    stage: string;
    completed: number;
    total: number;
    currentPath?: string;
  }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: {
      stage: string; completed: number; total: number; currentPath?: string;
    }) => callback(data);
    ipcRenderer.on('metanet-progress', handler);
    return () => ipcRenderer.removeListener('metanet-progress', handler);
  },

  // Mint documents
  listMintDocuments: () => ipcRenderer.invoke('list-mint-documents'),
  saveMintDocument: (docJson: string) => ipcRenderer.invoke('save-mint-document', docJson),
  loadMintDocument: (filePath: string) => ipcRenderer.invoke('load-mint-document', filePath),
  deleteMintDocument: (filePath: string) => ipcRenderer.invoke('delete-mint-document', filePath),
  exportMintPng: (payload: { dataUrl: string; defaultName?: string }) =>
    ipcRenderer.invoke('export-mint-png', payload),
  exportMintSvg: (payload: { svgContent: string; defaultName?: string }) =>
    ipcRenderer.invoke('export-mint-svg', payload),
  exportMintBatch: (payload: { folder: string; dataUrls: { name: string; dataUrl: string }[] }) =>
    ipcRenderer.invoke('export-mint-batch', payload),

  // --- BTMS (Basic Token Management System) ---
  btmsStatus: () => ipcRenderer.invoke('btms-status'),
  btmsIssue: (payload: { amount: number; metadata?: Record<string, unknown> }) =>
    ipcRenderer.invoke('btms-issue', payload),
  btmsListAssets: () => ipcRenderer.invoke('btms-list-assets'),
  btmsGetBalance: (assetId: string) => ipcRenderer.invoke('btms-get-balance', assetId),
  btmsSend: (payload: { assetId: string; recipient: string; amount: number }) =>
    ipcRenderer.invoke('btms-send', payload),
  btmsListIncoming: () => ipcRenderer.invoke('btms-list-incoming'),
  btmsAccept: (payment: unknown) => ipcRenderer.invoke('btms-accept', payment),
  btmsBurn: (payload: { assetId: string; amount?: number }) =>
    ipcRenderer.invoke('btms-burn', payload),

  // --- KYC (Veriff + BRC-KYC-Certificate) ---
  kycStart: (payload: { subjectAddress: string; email?: string }) =>
    ipcRenderer.invoke('kyc-start', payload),
  kycSession: () => ipcRenderer.invoke('kyc-session'),
  kycCertificate: () => ipcRenderer.invoke('kyc-certificate'),
  kycPoll: (sessionId: string) => ipcRenderer.invoke('kyc-poll', sessionId),
  kycVerifyCert: (payload: { certificate: string; signature: string }) =>
    ipcRenderer.invoke('kyc-verify-cert', payload),
  kycReset: () => ipcRenderer.invoke('kyc-reset')
});
