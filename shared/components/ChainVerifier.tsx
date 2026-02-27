'use client';

import React, { useEffect, useState } from 'react';
import type { OwnershipChain } from '@shared/lib/types';
import { verifyChain } from '@shared/lib/ownership-chain';

type Props = {
  chain: OwnershipChain;
  onClose: () => void;
};

export default function ChainVerifier({ chain, onClose }: Props) {
  const [result, setResult] = useState<ReturnType<typeof verifyChain> | null>(null);

  useEffect(() => {
    setResult(verifyChain(chain));
  }, [chain]);

  if (!result) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Chain Verification</h2>
          <button className="ghost" onClick={onClose}>&times;</button>
        </div>

        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>{result.valid ? '\u2705' : '\u274C'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: result.valid ? '#4caf50' : 'var(--danger)' }}>
              {result.valid ? 'Chain Valid' : 'Chain Invalid'}
            </span>
          </div>

          {/* Issuance check */}
          <div className="verify-row">
            <span className="verify-icon">{result.issuanceValid ? '\u2705' : '\u274C'}</span>
            <div>
              <div className="small" style={{ fontWeight: 600 }}>Issuance</div>
              <div className="small" style={{ color: 'var(--muted)' }}>
                {chain.issuance.issuerName || chain.issuance.issuerAddress.slice(0, 16) + '...'}
              </div>
            </div>
          </div>

          {/* Transfer checks */}
          {result.endorsements.map((e, i) => (
            <div key={e.id} className="verify-row">
              <span className="verify-icon">{e.valid ? '\u2705' : '\u274C'}</span>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>Transfer #{i + 1}</div>
                {!e.valid && e.reason && (
                  <div className="small" style={{ color: 'var(--danger)' }}>{e.reason}</div>
                )}
              </div>
            </div>
          ))}

          {chain.transfers.length === 0 && (
            <div className="small" style={{ color: 'var(--muted)', marginTop: 8 }}>
              No transfers yet — certificate is still with the original issuer.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 16px' }}>
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
