import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mint', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openImages: () => ipcRenderer.invoke('open-images'),
  openLogo: () => ipcRenderer.invoke('open-logo'),
  chooseExportFolder: () => ipcRenderer.invoke('choose-export-folder'),
  saveFile: (dataUrl: string, defaultDir?: string, defaultName?: string) =>
    ipcRenderer.invoke('save-file', { dataUrl, defaultDir, defaultName }),
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

  // Keystore
  keystoreHasKey: () => ipcRenderer.invoke('keystore-has-key'),
  keystoreSaveKey: (wif: string) => ipcRenderer.invoke('keystore-save-key', wif),
  keystoreDeleteKey: () => ipcRenderer.invoke('keystore-delete-key'),

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
    ipcRenderer.invoke('export-mint-batch', payload)
});
