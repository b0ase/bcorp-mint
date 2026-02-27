'use client';

import React, { useState, useMemo } from 'react';
import type { OwnedAsset, PortfolioSummary } from '@shared/lib/types';

type FilterTab = 'all' | 'stock' | 'bond' | 'currency' | 'stamp' | 'token';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'stock', label: 'Stocks' },
  { value: 'bond', label: 'Bonds' },
  { value: 'currency', label: 'Currency' },
  { value: 'stamp', label: 'Stamps' },
  { value: 'token', label: 'Tokens' },
];

type Props = {
  assets: OwnedAsset[];
  summary: PortfolioSummary;
  loading: boolean;
  onSelectAsset: (asset: OwnedAsset) => void;
  onReceive: () => void;
  onClose: () => void;
};

export default function PortfolioView({ assets, summary, loading, onSelectAsset, onReceive, onClose }: Props) {
  const [filter, setFilter] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return assets;
    return assets.filter(a => a.assetType === filter);
  }, [assets, filter]);

  const getCount = (tab: FilterTab): number => {
    if (tab === 'all') return summary.total;
    return summary[tab === 'stock' ? 'stocks' : tab === 'bond' ? 'bonds' : tab === 'currency' ? 'currency' : tab === 'stamp' ? 'stamps' : 'tokens'];
  };

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer portfolio-view" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Portfolio</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="secondary" onClick={onReceive}>Import</button>
            <button className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="portfolio-summary">
          <span className="portfolio-summary-total">{summary.total} asset{summary.total !== 1 ? 's' : ''}</span>
          {summary.stocks > 0 && <span className="portfolio-badge stock">{summary.stocks} Stock{summary.stocks !== 1 ? 's' : ''}</span>}
          {summary.bonds > 0 && <span className="portfolio-badge bond">{summary.bonds} Bond{summary.bonds !== 1 ? 's' : ''}</span>}
          {summary.currency > 0 && <span className="portfolio-badge currency">{summary.currency} Currency</span>}
          {summary.stamps > 0 && <span className="portfolio-badge stamp">{summary.stamps} Stamp{summary.stamps !== 1 ? 's' : ''}</span>}
          {summary.tokens > 0 && <span className="portfolio-badge token">{summary.tokens} Token{summary.tokens !== 1 ? 's' : ''}</span>}
        </div>

        {/* Filter tabs */}
        <div className="portfolio-filters">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              className={`portfolio-filter-tab${filter === tab.value ? ' active' : ''}`}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label} ({getCount(tab.value)})
            </button>
          ))}
        </div>

        {/* Asset grid */}
        <div className="portfolio-grid">
          {loading ? (
            <div className="portfolio-empty">Loading assets...</div>
          ) : filtered.length === 0 ? (
            <div className="portfolio-empty">
              {filter === 'all'
                ? 'No owned assets. Seal & Issue a certificate to get started.'
                : `No ${filter} assets found.`}
            </div>
          ) : (
            filtered.map(asset => (
              <div
                key={asset.vaultId}
                className="asset-card"
                onClick={() => onSelectAsset(asset)}
              >
                <div className="asset-card-thumb">
                  {asset.thumbnail ? (
                    <img src={asset.thumbnail} alt={asset.name} />
                  ) : (
                    <div className="asset-card-placeholder">{asset.assetType[0].toUpperCase()}</div>
                  )}
                  <span className={`asset-type-badge ${asset.assetType}`}>{asset.assetType}</span>
                </div>
                <div className="asset-card-info">
                  <div className="asset-card-name">{asset.name || 'Untitled'}</div>
                  <div className="asset-card-meta">
                    <span>{new Date(asset.acquiredAt).toLocaleDateString()}</span>
                    <span className="chain-badge">{asset.chainLength} endorsement{asset.chainLength !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
