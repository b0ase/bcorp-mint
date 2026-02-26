import type { MintPlatform, FileHandle, PlatformFeature, MasterKeyInfo, DerivedChild, WalletManifest } from '@shared/lib/platform';
import type { StampReceipt, WalletState, WalletProviderType } from '@shared/lib/types';
import * as bridge from './mint-bridge';

function fileHandle(file: File): FileHandle {
  return { type: 'file', file, name: file.name };
}

function pickFilesViaInput(accept?: string, multiple?: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    if (multiple) input.multiple = true;
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : []);
    };
    // User cancelled
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

const defaultWalletState: WalletState = {
  connected: false,
  handle: null,
  authToken: null,
  balance: null,
  provider: 'local',
  availableProviders: [{ type: 'local', available: true, label: 'Local Wallet' }],
  masterAddress: null,
};

export const browserPlatform: MintPlatform = {
  isDesktop: false,
  supportedFeatures: new Set<PlatformFeature>([
    // Browser supports a limited subset
  ]),

  // --- File operations ---

  async pickFiles(opts) {
    const accept = opts?.accept || 'image/*,video/*,audio/*';
    const files = await pickFilesViaInput(accept, opts?.multiple ?? true);
    return files.map(fileHandle);
  },

  async pickLogo() {
    const files = await pickFilesViaInput('image/png,image/svg+xml,image/jpeg', false);
    return files[0] ? fileHandle(files[0]) : null;
  },

  async getFileUrl(handle) {
    if (handle.type === 'file') return URL.createObjectURL(handle.file);
    // Path handles shouldn't appear in browser, but handle gracefully
    return handle.path;
  },

  getFileName(handle) {
    return handle.name;
  },

  // --- Hashing ---

  async hashFile(handle) {
    if (handle.type === 'file') {
      const result = await bridge.hashFile(handle.file);
      return { hash: result.hash, size: handle.file.size };
    }
    throw new Error('Path-based hashing not available in browser');
  },

  // --- Stamp receipts ---

  async saveStampReceipt(json) {
    await bridge.saveStampReceipt(json);
  },
  async updateStampReceipt(id, patch) {
    await bridge.updateStampReceipt(id, patch);
  },
  async listStampReceipts() {
    return bridge.listStampReceipts() as Promise<StampReceipt[]>;
  },

  // --- Mint documents ---

  async saveMintDocument(json) {
    await bridge.saveMintDocument(json);
  },
  async loadMintDocument(id) {
    return bridge.loadMintDocument(id);
  },
  async listMintDocuments() {
    return bridge.listMintDocuments();
  },
  async deleteMintDocument(id) {
    await bridge.deleteMintDocument(id);
  },

  // --- Export ---

  async exportPng(opts) {
    return bridge.exportMintPng(opts);
  },
  async exportSvg(opts) {
    bridge.exportMintSvg(opts);
  },

  // --- Keystore ---

  async keystoreHasMaster() {
    return bridge.keystoreHasMaster();
  },
  async keystoreSetupMaster() {
    return bridge.keystoreSetupMaster();
  },
  async keystoreGetMasterInfo() {
    return bridge.keystoreGetMasterInfo() as Promise<MasterKeyInfo>;
  },
  async keystoreDeriveAddress(protocol, slug) {
    return bridge.keystoreDeriveAddress(protocol, slug) as Promise<DerivedChild>;
  },
  async keystoreExportBackup(password) {
    return bridge.keystoreExportBackup(password);
  },
  async keystoreImportBackup(data, password) {
    return bridge.keystoreImportBackup(data, password) as Promise<MasterKeyInfo>;
  },
  async keystoreBuildManifest(derivations) {
    return bridge.keystoreBuildManifest(derivations) as Promise<WalletManifest>;
  },
  async keystoreDeleteMaster() {
    await bridge.keystoreDeleteMaster();
  },

  // --- Wallet ---

  async walletConnect() {
    // Browser uses HandCash OAuth via redirect — return default state
    // The actual auth flow is handled by /api/auth/handcash
    return defaultWalletState;
  },
  async walletStatus() {
    // Check if we have a local master key
    const hasMaster = await bridge.keystoreHasMaster();
    if (hasMaster) {
      try {
        const info = await bridge.keystoreGetMasterInfo();
        return {
          ...defaultWalletState,
          connected: true,
          masterAddress: info.address,
        };
      } catch {
        return defaultWalletState;
      }
    }
    return defaultWalletState;
  },
  async walletDisconnect() {
    // No-op in browser for now
  },
  async walletListProviders() {
    return [{ type: 'local' as WalletProviderType, available: true, label: 'Local Wallet' }];
  },
  async walletSwitchProvider() {
    return defaultWalletState;
  },

  // --- Inscription ---

  async inscribeStamp(opts) {
    return bridge.inscribeStamp(opts);
  },

  // Desktop-only features are undefined (not in supportedFeatures)
};
