'use client';

import React from 'react';
import type { OwnedAsset, OwnershipChain } from '@shared/lib/types';

type Props = {
  asset: OwnedAsset;
  onTransfer: () => void;
  onVerify: () => void;
  onViewEndorsements: () => void;
  onClose: () => void;
};

export default function AssetDetailView({ asset, onTransfer, onVerify, onViewEndorsements, onClose }: Props) {
  const chain = asset.ownershipChain;

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer asset-detail" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>{asset.name || 'Untitled Asset'}</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div className="asset-detail-body">
          {/* Preview */}
          <div className="asset-detail-preview">
            {asset.thumbnail ? (
              <img src={asset.thumbnail} alt={asset.name} />
            ) : (
              <div className="asset-detail-placeholder">{asset.assetType}</div>
            )}
          </div>

          {/* Info grid */}
          <div className="asset-detail-info">
            <div className="asset-detail-row">
              <span className="asset-detail-label">Type</span>
              <span className={`asset-type-badge ${asset.assetType}`}>{asset.assetType}</span>
            </div>
            <div className="asset-detail-row">
              <span className="asset-detail-label">Acquired</span>
              <span>{new Date(asset.acquiredAt).toLocaleDateString()}</span>
            </div>
            <div className="asset-detail-row">
              <span className="asset-detail-label">Current Holder</span>
              <span className="asset-detail-address">
                {chain.currentHolder.name || chain.currentHolder.address.slice(0, 12) + '...'}
              </span>
            </div>
            <div className="asset-detail-row">
              <span className="asset-detail-label">Issuer</span>
              <span className="asset-detail-address">
                {chain.issuance.issuerName || chain.issuance.issuerAddress.slice(0, 12) + '...'}
              </span>
            </div>
            <div className="asset-detail-row">
              <span className="asset-detail-label">Endorsements</span>
              <span className="chain-badge">{1 + chain.transfers.length}</span>
            </div>
            <div className="asset-detail-row">
              <span className="asset-detail-label">Asset Hash</span>
              <span
                className="asset-detail-hash"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(chain.assetHash)}
              >
                {chain.assetHash.slice(0, 12)}...{chain.assetHash.slice(-8)}
              </span>
            </div>
          </div>

          {/* Endorsement timeline (compact) */}
          <div className="asset-detail-chain">
            <h4>Ownership Chain</h4>
            <div className="asset-detail-timeline">
              <div className="asset-detail-event issuance">
                <span className="asset-detail-event-dot" />
                <span className="asset-detail-event-text">
                  Issued by {chain.issuance.issuerName || chain.issuance.issuerAddress.slice(0, 10) + '...'}
                </span>
                <span className="asset-detail-event-date">
                  {new Date(chain.issuance.timestamp).toLocaleDateString()}
                </span>
              </div>
              {chain.transfers.map((t, i) => (
                <div key={t.id} className="asset-detail-event transfer">
                  <span className="asset-detail-event-dot" />
                  <span className="asset-detail-event-text">
                    {t.fromName || t.fromAddress.slice(0, 8) + '...'} &rarr; {t.toName || t.toAddress.slice(0, 8) + '...'}
                  </span>
                  <span className="asset-detail-event-date">
                    {new Date(t.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="asset-detail-actions">
            <button onClick={onTransfer}>Transfer</button>
            <button className="secondary" onClick={onViewEndorsements}>View Full Chain</button>
            <button className="secondary" onClick={onVerify}>Verify Chain</button>
          </div>
        </div>
      </div>
    </div>
  );
}
