import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('npg', {
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
  inscribeStamp: (payload: { path: string; hash: string; timestamp: string }) =>
    ipcRenderer.invoke('inscribe-stamp', payload),
  mintStampToken: (payload: { path: string; hash: string; name: string }) =>
    ipcRenderer.invoke('mint-stamp-token', payload),

  // Keystore
  keystoreHasKey: () => ipcRenderer.invoke('keystore-has-key'),
  keystoreSaveKey: (wif: string) => ipcRenderer.invoke('keystore-save-key', wif),
  keystoreDeleteKey: () => ipcRenderer.invoke('keystore-delete-key')
});
