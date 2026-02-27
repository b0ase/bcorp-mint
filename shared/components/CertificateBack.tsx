'use client';

import React from 'react';
import type { OwnershipChain } from '@shared/lib/types';

type Props = {
  chain: OwnershipChain;
  onTransfer: () => void;
  onVerify: () => void;
  onClose: () => void;
};

export default function CertificateBack({ chain, onTransfer, onVerify, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cert-back-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Endorsement Chain</h2>
          <button className="ghost" onClick={onClose}>&times;</button>
        </div>

        <div className="cert-back-meta">
          <div className="small">Asset: <strong>{chain.assetId}</strong></div>
          <div className="small">Type: <strong>{chain.assetType}</strong></div>
          <div className="small" style={{ fontFamily: 'IBM Plex Mono', fontSize: 10 }}>
            Hash: {chain.assetHash.slice(0, 16)}...{chain.assetHash.slice(-8)}
          </div>
        </div>

        <div className="cert-back-chain">
          {/* Issuance event */}
          <div className="chain-event chain-issuance">
            <div className="chain-event-dot issuance" />
            <div className="chain-event-content">
              <div className="chain-event-type">Issued</div>
              <div className="chain-event-detail">
                <strong>{chain.issuance.issuerName || chain.issuance.issuerAddress.slice(0, 12) + '...'}</strong>
              </div>
              <div className="chain-event-time">{new Date(chain.issuance.timestamp).toLocaleString()}</div>
              {chain.issuance.txid && (
                <div className="chain-event-txid">TX: {chain.issuance.txid.slice(0, 12)}...</div>
              )}
            </div>
          </div>

          {/* Transfer events */}
          {chain.transfers.map((t) => (
            <div key={t.id} className="chain-event chain-transfer">
              <div className="chain-event-dot transfer" />
              <div className="chain-event-content">
                <div className="chain-event-type">Transferred</div>
                <div className="chain-event-detail">
                  <span>{t.fromName || t.fromAddress.slice(0, 12) + '...'}</span>
                  <span className="chain-arrow">&rarr;</span>
                  <strong>{t.toName || t.toAddress.slice(0, 12) + '...'}</strong>
                </div>
                <div className="chain-event-time">{new Date(t.timestamp).toLocaleString()}</div>
                {t.txid && (
                  <div className="chain-event-txid">TX: {t.txid.slice(0, 12)}...</div>
                )}
              </div>
            </div>
          ))}

          {/* Current holder */}
          <div className="chain-event chain-current">
            <div className="chain-event-dot current" />
            <div className="chain-event-content">
              <div className="chain-event-type">Current Holder</div>
              <div className="chain-event-detail">
                <strong>{chain.currentHolder.name || chain.currentHolder.address.slice(0, 16) + '...'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="cert-back-actions">
          <button className="secondary" onClick={onVerify}>Verify Chain</button>
          <button onClick={onTransfer}>Transfer</button>
        </div>
      </div>
    </div>
  );
}
