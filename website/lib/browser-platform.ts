import type { MintPlatform, FileHandle, PlatformFeature, MasterKeyInfo, DerivedChild, WalletManifest } from '@shared/lib/platform';
import type { StampReceipt, WalletState, WalletProviderType } from '@shared/lib/types';
import * as bridge from './mint-bridge';
import { getActiveActionProvider, getActiveProvider } from './providers/active';
import { isBWalletAvailable } from '@shared/lib/bwallet';

/** Stamps, mints and signatures go through the active BRC-100 wallet when there is one. */
async function describe(prefix: string, detail: string): Promise<string> {
  const s = `${prefix} ${detail}`.trim();
  return s.length > 50 ? s.slice(0, 50) : s.padEnd(5, '.');
}

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
  // The React wallet manager (use-web-wallet-manager.ts) owns connection state and
  // publishes the active provider; these reflect it for code that only has the platform.

  async walletConnect() {
    return this.walletStatus();
  },
  async walletStatus() {
    const active = getActiveProvider();
    if (active) {
      const status = await active.getStatus();
      return {
        ...defaultWalletState,
        provider: active.type === 'bwallet' ? 'yours' : (active.type as WalletProviderType),
        connected: status.connected,
        handle: status.handle,
        balance: status.balance,
        masterAddress: status.address,
        availableProviders: await this.walletListProviders(),
      };
    }
    // Local keystore
    const hasMaster = await bridge.keystoreHasMaster();
    if (hasMaster) {
      try {
        const info = await bridge.keystoreGetMasterInfo();
        return {
          ...defaultWalletState,
          connected: true,
          masterAddress: info.address,
          availableProviders: await this.walletListProviders(),
        };
      } catch {
        return defaultWalletState;
      }
    }
    return { ...defaultWalletState, availableProviders: await this.walletListProviders() };
  },
  async walletDisconnect() {
    const active = getActiveProvider();
    if (active) await active.disconnect();
  },
  async walletListProviders() {
    return [
      { type: 'local' as WalletProviderType, available: true, label: 'Local Wallet' },
      { type: 'yours' as WalletProviderType, available: isBWalletAvailable(), label: 'bWallet' },
    ];
  },
  async walletSwitchProvider() {
    return this.walletStatus();
  },
  async walletCanInscribe() {
    if (getActiveActionProvider()) return true;
    return bridge.keystoreHasMaster();
  },

  // --- Inscription ---

  async inscribeStamp(opts) {
    const wallet = getActiveActionProvider();
    if (wallet?.createAction) {
      const { txid } = await wallet.createAction({
        description: await describe('Mint stamp', opts.path),
        outputs: [{ lockingScript: bridge.buildStampOpReturnHex(opts), satoshis: 0, outputDescription: 'STAMP proof' }],
        labels: ['bmint', 'stamp'],
      });
      return { txid };
    }
    return bridge.inscribeStamp(opts);
  },

  // --- Token minting (BSV-21 via 1Sat Ordinals) ---

  async mintStampToken(opts) {
    const wallet = getActiveActionProvider();
    if (wallet?.createAction) {
      const address = await wallet.getAddress('mint token', opts.path);
      const { txid } = await wallet.createAction({
        description: await describe('Mint token', bridge.bsv21Symbol(opts.name)),
        outputs: [
          {
            lockingScript: await bridge.buildTokenInscriptionHex(opts.name, address),
            satoshis: 1,
            outputDescription: 'BSV-21 token',
            basket: 'bmint tokens',
          },
        ],
        labels: ['bmint', 'bsv21'],
      });
      return { tokenId: `${txid}_0` };
    }
    return bridge.mintStampToken(opts);
  },

  async batchMintTokens(pieces) {
    if (!getActiveActionProvider()) return bridge.batchMintTokens(pieces);
    for (let i = 0; i < pieces.length; i++) {
      try {
        await this.mintStampToken!(pieces[i]);
      } catch (err) {
        console.error(`Batch mint failed at piece ${i}:`, err);
      }
      if (i < pieces.length - 1) await new Promise((r) => setTimeout(r, 200));
    }
  },

  // --- Message signing ---

  async signMessage(message: string) {
    const active = getActiveProvider();
    if (active?.signMessage) return active.signMessage(message);
    return bridge.signMessage(message);
  },
};
