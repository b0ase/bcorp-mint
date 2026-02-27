'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { listVaultEntries, type VaultEntry } from '@shared/lib/mint-vault';
import type { OwnedAsset, OwnershipChain, PortfolioSummary } from '@shared/lib/types';

/**
 * usePortfolio — loads vault entries that have an ownership chain
 * where `currentHolder.address` matches the user's wallet address.
 */
export function usePortfolio(userAddress: string | null) {
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await listVaultEntries();
      const owned: OwnedAsset[] = [];

      for (const entry of entries) {
        if (!entry.ownershipChain) continue;
        try {
          const chain: OwnershipChain = JSON.parse(entry.ownershipChain);
          // Show all assets with chains if no wallet connected,
          // or filter to current holder when wallet is connected
          if (!userAddress || chain.currentHolder.address === userAddress) {
            owned.push({
              vaultId: entry.id,
              name: entry.name,
              assetType: chain.assetType,
              thumbnail: entry.thumbnail,
              acquiredAt: entry.createdAt,
              ownershipChain: chain,
              chainLength: 1 + chain.transfers.length,
              docJson: entry.docJson,
            });
          }
        } catch {
          // skip entries with malformed chain JSON
        }
      }

      // Sort newest first
      owned.sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
      setAssets(owned);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary: PortfolioSummary = useMemo(() => {
    const s: PortfolioSummary = { total: 0, stocks: 0, bonds: 0, currency: 0, stamps: 0, tokens: 0 };
    for (const a of assets) {
      s.total++;
      if (a.assetType === 'stock') s.stocks++;
      else if (a.assetType === 'bond') s.bonds++;
      else if (a.assetType === 'currency') s.currency++;
      else if (a.assetType === 'stamp') s.stamps++;
      else if (a.assetType === 'token') s.tokens++;
    }
    return s;
  }, [assets]);

  return { assets, summary, loading, error, refresh };
}
