'use client';

import React, { useState } from 'react';

type Props = {
  currentHolder: string;
  onTransfer: (toAddress: string, toName: string) => Promise<void>;
  onClose: () => void;
};

export default function TransferModal({ currentHolder, onTransfer, onClose }: Props) {
  const [toAddress, setToAddress] = useState('');
  const [toName, setToName] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!toAddress.trim()) {
      setError('Recipient address is required');
      return;
    }
    setError('');
    setTransferring(true);
    try {
      await onTransfer(toAddress.trim(), toName.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Transfer Certificate</h2>
          <button className="ghost" onClick={onClose}>&times;</button>
        </div>

        <div className="section">
          <div className="small" style={{ color: 'var(--muted)', marginBottom: 12 }}>
            Transfer beneficial title from <strong>{currentHolder}</strong> to a new holder.
            This will append a signed endorsement to the ownership chain.
          </div>

          <div className="control-group">
            <label className="control-row">
              <span>Recipient Address</span>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="BSV address or public key"
              />
            </label>
            <label className="control-row">
              <span>Recipient Name</span>
              <input
                type="text"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Optional display name"
              />
            </label>
          </div>

          {error && (
            <div className="small" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
          <button className="secondary" onClick={onClose} disabled={transferring}>Cancel</button>
          <button onClick={handleSubmit} disabled={transferring || !toAddress.trim()}>
            {transferring ? 'Signing...' : 'Sign & Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
