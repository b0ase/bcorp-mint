'use client';

/**
 * Web wallet manager: the browser counterpart of the desktop app's useWalletManager.
 * Lists the wallets the page can use, tracks which one is active, and publishes it
 * to the platform layer (providers/active.ts) so stamps, mints and signatures route
 * through it.
 *
 *   local     the Mint's own HD keystore in IndexedDB (mint-bridge)
 *   bwallet   BRC-100: bWallet frame / browser, or any injected window.CWI provider
 *   handcash  HandCash OAuth (cookie session; not available inside bWallet's frame,
 *             where third-party cookies are partitioned)
 *   metanet   MetaNet Desktop over HTTP on localhost (desktop browsers only)
 *
 * MintApp's WalletState uses the shared provider ids; bWallet maps onto 'yours'
 * (bWallet is a Yours-derived wallet) so the shared types stay unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WalletProviderType as SharedProviderType, WalletState } from '@shared/lib/types';
import { detectBWallet, displayNameFor, isBWalletAvailable } from '@shared/lib/bwallet';
import { BWalletProvider } from './providers/bwallet-wallet';
import { MetaNetWalletProvider, isMetaNetAvailable } from './providers/metanet-wallet';
import { setActiveProvider } from './providers/active';
import type { WalletProvider } from './providers/wallet-provider';
import * as bridge from './mint-bridge';

type WebProvider = 'local' | 'bwallet' | 'handcash' | 'metanet';

const toShared = (p: WebProvider): SharedProviderType => (p === 'bwallet' ? 'yours' : p);
const fromShared = (t: string): WebProvider => (t === 'yours' ? 'bwallet' : (t as WebProvider));

const STORAGE_KEY = 'bmint.wallet.provider';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

const EMPTY: WalletState = {
  connected: false,
  handle: null,
  authToken: null,
  balance: null,
  provider: 'local',
  availableProviders: [],
  masterAddress: null,
};

export function useWebWalletManager() {
  const [walletState, setWalletState] = useState<WalletState>(EMPTY);
  const [provider, setProvider] = useState<WebProvider>('local');
  const [bwalletAvailable, setBwalletAvailable] = useState(false);
  const [metanetAvailable, setMetanetAvailable] = useState(false);
  const [inWallet, setInWallet] = useState(false);

  const bwallet = useRef<BWalletProvider | null>(null);
  const metanet = useRef<MetaNetWalletProvider | null>(null);
  // The provider as of the latest render. A refresh that awaited IndexedDB or the wallet
  // must not write its result if the user (or the host detection) switched meanwhile.
  const latestProvider = useRef<WebProvider>(provider);
  latestProvider.current = provider;
  const getBWallet = () => (bwallet.current ??= new BWalletProvider());
  const getMetaNet = () => (metanet.current ??= new MetaNetWalletProvider());

  const availableProviders = useMemo<WalletState['availableProviders']>(
    () => [
      { type: 'local', available: true, label: 'Local Wallet' },
      { type: 'yours', available: bwalletAvailable, label: 'bWallet' },
      { type: 'handcash', available: !inWallet, label: 'HandCash' },
      { type: 'metanet', available: metanetAvailable, label: 'MetaNet Desktop' },
    ],
    [bwalletAvailable, inWallet, metanetAvailable],
  );

  // Detect the host once, pick the starting provider, probe MetaNet on desktop browsers.
  useEffect(() => {
    const env = detectBWallet();
    const bw = isBWalletAvailable();
    setInWallet(env.inWallet);
    setBwalletAvailable(bw);
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    const start: WebProvider = saved ? fromShared(saved) : bw ? 'bwallet' : 'local';
    setProvider(start === 'bwallet' && !bw ? 'local' : start);
    if (!env.inWallet) {
      isMetaNetAvailable().then(setMetanetAvailable).catch(() => setMetanetAvailable(false));
    }
  }, []);

  const publish = useCallback((p: WebProvider, connected: boolean) => {
    let active: WalletProvider | null = null;
    if (connected && p === 'bwallet') active = getBWallet();
    if (connected && p === 'metanet') active = getMetaNet();
    setActiveProvider(active);
  }, []);

  const refresh = useCallback(async () => {
    const stale = () => latestProvider.current !== provider;
    try {
      if (provider === 'local') {
        const hasMaster = await bridge.keystoreHasMaster();
        const info = hasMaster ? await bridge.keystoreGetMasterInfo().catch(() => null) : null;
        if (stale()) return;
        publish('local', false);
        setWalletState((prev) => ({
          ...prev,
          provider: 'local',
          connected: !!info,
          handle: null,
          authToken: null,
          balance: null,
          masterAddress: info?.address ?? null,
          availableProviders,
        }));
      } else if (provider === 'handcash') {
        const handle = readCookie('handcash_handle');
        publish('handcash', false);
        setWalletState((prev) => ({
          ...prev,
          provider: 'handcash',
          connected: !!handle,
          handle: handle ? `$${handle.replace(/^\$/, '')}` : null,
          authToken: null,
          balance: null,
          masterAddress: null,
          availableProviders,
        }));
      } else if (provider === 'bwallet') {
        const bw = getBWallet();
        const id = bw.getIdentity();
        publish('bwallet', !!id);
        setWalletState((prev) => ({
          ...prev,
          provider: 'yours',
          connected: !!id,
          handle: id ? displayNameFor(id) : null,
          authToken: null,
          balance: null,
          masterAddress: id?.ordAddress ?? null,
          availableProviders,
        }));
      } else {
        const mn = getMetaNet();
        const status = await mn.getStatus();
        if (stale()) return;
        publish('metanet', status.connected);
        setWalletState((prev) => ({
          ...prev,
          provider: 'metanet',
          connected: status.connected,
          handle: status.handle,
          authToken: null,
          balance: status.balance,
          masterAddress: status.address,
          availableProviders,
        }));
      }
    } catch (err) {
      console.error('[useWebWalletManager] refresh failed:', err);
    }
  }, [provider, availableProviders, publish]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchProvider = useCallback(
    async (type: SharedProviderType) => {
      const next = fromShared(type);
      try {
        sessionStorage.setItem(STORAGE_KEY, type);
      } catch {
        /* storage unavailable */
      }
      setProvider(next);
    },
    [],
  );

  const connect = useCallback(async () => {
    try {
      if (provider === 'local') {
        if (!(await bridge.keystoreHasMaster())) await bridge.keystoreSetupMaster();
      } else if (provider === 'handcash') {
        window.location.href = '/api/auth/handcash';
        return;
      } else if (provider === 'bwallet') {
        await getBWallet().connect();
      } else {
        await getMetaNet().connect();
      }
      await refresh();
    } catch (err) {
      console.error('[useWebWalletManager] connect failed:', err);
      throw err;
    }
  }, [provider, refresh]);

  const disconnect = useCallback(async () => {
    try {
      if (provider === 'handcash') {
        await fetch('/api/auth/logout', { credentials: 'include' }).catch(() => undefined);
      } else if (provider === 'bwallet') {
        await getBWallet().disconnect();
      } else if (provider === 'metanet') {
        await getMetaNet().disconnect();
      }
      // The local keystore is not "disconnected": deleting a key is an explicit action in WalletView.
    } finally {
      await refresh();
    }
  }, [provider, refresh]);

  return { walletState, switchProvider, connect, disconnect, refresh };
}
