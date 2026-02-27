'use client';

import React, { useState } from 'react';
import { verifyChain } from '@shared/lib/ownership-chain';
import { saveToVault, encryptForVault, hexFromBytes, type VaultEntry } from '@shared/lib/mint-vault';
import type { OwnershipChain } from '@shared/lib/types';

type Props = {
  onImported: () => void;
  onClose: () => void;
};

export default function ReceiveAssetModal({ onImported, onClose }: Props) {
  const [inputData, setInputData] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'importing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [chainPreview, setChainPreview] = useState<OwnershipChain | null>(null);

  const handleValidate = () => {
    setError('');
    setChainPreview(null);
    setStatus('validating');

    try {
      const parsed = JSON.parse(inputData.trim());

      // Basic shape check
      if (!parsed.assetId || !parsed.assetHash || !parsed.issuance || !parsed.currentHolder) {
        throw new Error('Invalid ownership chain: missing required fields.');
      }

      const chain = parsed as OwnershipChain;
      const result = verifyChain(chain);

      if (!result.valid) {
        const reasons = result.endorsements.filter(e => !e.valid).map(e => e.reason).filter(Boolean);
        throw new Error(`Chain verification failed: ${reasons.length > 0 ? reasons.join('; ') : 'invalid issuance'}`);
      }

      setChainPreview(chain);
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse chain data.');
      setStatus('error');
    }
  };

  const handleImport = async () => {
    if (!chainPreview) return;
    setStatus('importing');
    setError('');

    try {
      const docJson = JSON.stringify({ importedChain: true, assetId: chainPreview.assetId });
      const { iv, envelopeKey } = await encryptForVault(docJson);

      const entry: VaultEntry = {
        id: chainPreview.assetId,
        name: `Received: ${chainPreview.assetType} (${chainPreview.currentHolder.name || chainPreview.currentHolder.address.slice(0, 8) + '...'})`,
        thumbnail: '',
        createdAt: new Date().toISOString(),
        status: 'local',
        iv: hexFromBytes(iv),
        wrappedKey: hexFromBytes(envelopeKey),
        docJson,
        fileSize: 0,
        ownershipChain: JSON.stringify(chainPreview),
      };

      await saveToVault(entry);
      setStatus('done');
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStatus('error');
    }
  };

  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.mint';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      setInputData(text.trim());
    };
    input.click();
  };

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer receive-modal" style={{ maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Receive Asset</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: 20 }}>
          {status === 'done' ? (
            <div className="receive-done">
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>&#x2705;</div>
              <p style={{ textAlign: 'center', color: 'var(--accent)' }}>
                Asset imported successfully. It now appears in your Portfolio.
              </p>
              <button style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <p className="small" style={{ marginBottom: 12 }}>
                Paste the ownership chain JSON from the sender, or load a <code>.json</code> / <code>.mint</code> file.
              </p>

              <textarea
                rows={6}
                value={inputData}
                onChange={(e) => { setInputData(e.target.value); setChainPreview(null); setStatus('idle'); setError(''); }}
                placeholder='{"assetId": "...", "assetHash": "...", ...}'
                style={{ width: '100%', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, background: 'var(--panel-2)', border: '1px solid var(--muted)', borderRadius: 8, padding: 10, color: 'var(--text)', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="secondary" onClick={handleLoadFile} style={{ flex: 1 }}>Load File</button>
                <button
                  onClick={handleValidate}
                  disabled={!inputData.trim() || status === 'validating'}
                  style={{ flex: 1 }}
                >
                  {status === 'validating' ? 'Validating...' : 'Validate'}
                </button>
              </div>

              {error && <div className="wallet-view-error" style={{ marginTop: 10 }}>{error}</div>}

              {chainPreview && (
                <div className="receive-preview" style={{ marginTop: 16, background: 'var(--panel-2)', borderRadius: 12, padding: 14 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--accent)' }}>Chain Verified</h4>
                  <div className="small">
                    <div><strong>Asset:</strong> {chainPreview.assetType} &mdash; {chainPreview.assetId.slice(0, 12)}...</div>
                    <div><strong>Issuer:</strong> {chainPreview.issuance.issuerName || chainPreview.issuance.issuerAddress.slice(0, 16) + '...'}</div>
                    <div><strong>Current Holder:</strong> {chainPreview.currentHolder.name || chainPreview.currentHolder.address.slice(0, 16) + '...'}</div>
                    <div><strong>Transfers:</strong> {chainPreview.transfers.length}</div>
                    <div><strong>Hash:</strong> <code>{chainPreview.assetHash.slice(0, 16)}...</code></div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={status === 'importing'}
                    style={{ width: '100%', marginTop: 12 }}
                  >
                    {status === 'importing' ? 'Importing...' : 'Import to Vault'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
