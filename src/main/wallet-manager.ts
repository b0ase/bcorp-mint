import type { WalletProvider, WalletProviderType, WalletProviderStatus } from './wallet-provider';
import { LocalWallet } from './providers/local-wallet';
import { HandCashWallet } from './providers/handcash-wallet';
import { MetaNetWallet } from './providers/metanet-wallet';
import { hasMasterKey, hasPrivateKey } from './keystore';

export class WalletManager {
  private providers: Map<WalletProviderType, WalletProvider> = new Map();
  private activeType: WalletProviderType = 'local';

  constructor() {
    this.providers.set('local', new LocalWallet());
    this.providers.set('handcash', new HandCashWallet());
    this.providers.set('metanet', new MetaNetWallet());
  }

  getActive(): WalletProvider {
    return this.providers.get(this.activeType)!;
  }

  getActiveType(): WalletProviderType {
    return this.activeType;
  }

  getProvider(type: WalletProviderType): WalletProvider {
    return this.providers.get(type)!;
  }

  async switchProvider(type: WalletProviderType): Promise<WalletProviderStatus> {
    // Disconnect current
    const current = this.providers.get(this.activeType);
    if (current) {
      try { await current.disconnect(); } catch { /* ignore */ }
    }

    this.activeType = type;
    const provider = this.providers.get(type)!;
    await provider.connect();
    return provider.getStatus();
  }

  async detectAvailableProviders(): Promise<Array<{
    type: WalletProviderType;
    available: boolean;
    label: string;
  }>> {
    const hasLocal = await hasMasterKey() || await hasPrivateKey();
    const hasMetaNet = await MetaNetWallet.isAvailable();

    return [
      { type: 'local', available: hasLocal, label: 'Local Keypair' },
      { type: 'handcash', available: true, label: 'HandCash' },
      { type: 'metanet', available: hasMetaNet, label: 'MetaNet Desktop' },
    ];
  }

  async getStatus(): Promise<{
    active: WalletProviderType;
    status: WalletProviderStatus;
    available: Array<{ type: WalletProviderType; available: boolean; label: string }>;
  }> {
    const provider = this.providers.get(this.activeType)!;
    const status = await provider.getStatus();
    const available = await this.detectAvailableProviders();
    return { active: this.activeType, status, available };
  }
}
