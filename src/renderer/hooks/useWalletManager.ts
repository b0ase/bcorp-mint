import { useState, useEffect, useCallback } from 'react';
import type { WalletProviderType, WalletState } from '@shared/lib/types';

const DEFAULT_STATE: WalletState = {
  connected: false,
  handle: null,
  authToken: null,
  balance: null,
  provider: 'local',
  availableProviders: [
    { type: 'local', available: false, label: 'Local Keypair' },
    { type: 'handcash', available: true, label: 'HandCash' },
    { type: 'yours', available: true, label: 'Yours Wallet' },
    { type: 'metanet', available: false, label: 'MetaNet Client' },
  ],
  masterAddress: null,
};

export function useWalletManager() {
  const [walletState, setWalletState] = useState<WalletState>(DEFAULT_STATE);

  const refresh = useCallback(async () => {
    try {
      const [status, masterInfo, providers] = await Promise.all([
        window.mint.walletStatus(),
        window.mint.keystoreGetMasterInfo(),
        window.mint.walletListProviders(),
      ]);

      setWalletState((prev) => ({
        ...prev,
        connected: status.connected || !!masterInfo,
        handle: status.handle,
        authToken: status.authToken,
        balance: status.balance,
        masterAddress: masterInfo?.address ?? null,
        availableProviders: providers as WalletState['availableProviders'],
      }));
    } catch (err) {
      console.error('[useWalletManager] refresh failed:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchProvider = useCallback(async (type: WalletProviderType) => {
    try {
      const result = await window.mint.walletSwitchProvider(type);
      setWalletState((prev) => ({
        ...prev,
        provider: type,
        connected: result.connected,
        handle: result.handle,
        masterAddress: result.address,
        balance: result.balance,
      }));
    } catch (err) {
      console.error('[useWalletManager] switchProvider failed:', err);
    }
  }, []);

  const connect = useCallback(async () => {
    if (walletState.provider === 'handcash') {
      const result = await window.mint.walletConnect();
      setWalletState((prev) => ({
        ...prev,
        connected: result.connected,
        handle: result.handle,
        authToken: result.authToken,
        balance: result.balance,
      }));
    } else if (walletState.provider === 'local') {
      const hasMaster = await window.mint.keystoreHasMaster();
      if (!hasMaster) {
        const info = await window.mint.keystoreSetupMaster();
        setWalletState((prev) => ({
          ...prev,
          connected: true,
          masterAddress: info.address,
        }));
      } else {
        setWalletState((prev) => ({ ...prev, connected: true }));
      }
    } else if (walletState.provider === 'yours') {
      const result = await window.mint.walletConnect();
      setWalletState((prev) => ({
        ...prev,
        connected: result.connected,
        handle: result.handle,
        authToken: result.authToken,
        balance: result.balance,
      }));
    } else {
      await switchProvider('metanet');
    }
  }, [walletState.provider, switchProvider]);

  const disconnect = useCallback(async () => {
    if (walletState.provider === 'handcash' || walletState.provider === 'yours') {
      await window.mint.walletDisconnect();
    }
    setWalletState((prev) => ({
      ...prev,
      connected: false,
      handle: null,
      authToken: null,
      balance: null,
    }));
  }, [walletState.provider]);

  return { walletState, switchProvider, connect, disconnect, refresh };
}
