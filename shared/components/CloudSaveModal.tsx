'use client';

import React, { useState } from 'react';
import {
  attestAndEncrypt,
  uploadToCloud,
  exportBundleFile,
} from '@shared/lib/cloud-vault';
import type { AttestationProof, EncryptedBundle } from '@shared/lib/types';

type Step = 'ready' | 'signing' | 'encrypting' | 'uploading' | 'done' | 'error';

type Props = {
  docJson: string;
  name: string;
  assetType: string;
  signMessage: (message: string) => Promise<{ signature: string; address: string }>;
  onSaved: (cloudId: string, attestation: AttestationProof) => void;
  onClose: () => void;
};

export default function CloudSaveModal({ docJson, name, assetType, signMessage, onSaved, onClose }: Props) {
  const [step, setStep] = useState<Step>('ready');
  const [error, setError] = useState('');
  const [bundle, setBundle] = useState<EncryptedBundle | null>(null);
  const [cloudId, setCloudId] = useState<string | null>(null);

  const handleSave = async () => {
    setError('');
    try {
      // Step 1: Sign & Attest
      setStep('signing');
      const result = await attestAndEncrypt(docJson, name, assetType, signMessage);
      setBundle(result.bundle);

      // Step 2: Encrypt (already done in attestAndEncrypt)
      setStep('encrypting');

      // Step 3: Upload
      setStep('uploading');
      const { cloudId: id } = await uploadToCloud(result.bundle);
      setCloudId(id);

      // Done
      setStep('done');
      onSaved(id, result.attestation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud save failed');
      setStep('error');
    }
  };

  const handleDownloadBundle = () => {
    if (bundle) exportBundleFile(bundle);
  };

  const stepLabels: Record<Step, string> = {
    ready: 'Ready to save',
    signing: 'Signing attestation with wallet...',
    encrypting: 'Encrypting document...',
    uploading: 'Uploading encrypted bundle...',
    done: 'Saved to cloud',
    error: 'Failed',
  };

  const stepNumber = (s: Step): number => {
    const order: Step[] = ['ready', 'signing', 'encrypting', 'uploading', 'done'];
    return order.indexOf(s);
  };

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer cloud-save-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Cloud Save</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Step indicators */}
          <div className="cloud-steps">
            {(['signing', 'encrypting', 'uploading', 'done'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`cloud-step${stepNumber(step) >= i + 1 ? ' active' : ''}${step === s ? ' current' : ''}`}
              >
                <span className="cloud-step-num">{i + 1}</span>
                <span className="cloud-step-label">
                  {s === 'signing' ? 'Sign' : s === 'encrypting' ? 'Encrypt' : s === 'uploading' ? 'Upload' : 'Done'}
                </span>
              </div>
            ))}
          </div>

          <div className="cloud-status">{stepLabels[step]}</div>

          {step === 'ready' && (
            <div>
              <p className="small" style={{ marginBottom: 16, color: 'var(--muted)' }}>
                Your design will be signed with your wallet, encrypted locally, and uploaded as an encrypted bundle.
                No plaintext leaves your device.
              </p>
              <div style={{ background: 'var(--panel-2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div className="small"><strong>Name:</strong> {name || 'Untitled'}</div>
                <div className="small"><strong>Type:</strong> {assetType}</div>
              </div>
              <button onClick={handleSave} style={{ width: '100%' }}>
                Sign & Save to Cloud
              </button>
            </div>
          )}

          {step === 'error' && (
            <div>
              <div className="wallet-view-error" style={{ marginBottom: 12 }}>{error}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => setStep('ready')} style={{ flex: 1 }}>
                  Try Again
                </button>
                {bundle && (
                  <button className="secondary" onClick={handleDownloadBundle} style={{ flex: 1 }}>
                    Download .mint File
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div>
              <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 12 }}>&#x2601;&#xFE0F;</div>
              <p style={{ textAlign: 'center', color: 'var(--accent)', marginBottom: 16 }}>
                Design saved to cloud vault.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {bundle && (
                  <button className="secondary" onClick={handleDownloadBundle} style={{ flex: 1 }}>
                    Download .mint Backup
                  </button>
                )}
                <button onClick={onClose} style={{ flex: 1 }}>Done</button>
              </div>
            </div>
          )}

          {(step === 'signing' || step === 'encrypting' || step === 'uploading') && (
            <div className="cloud-working">
              <div className="wallet-view-spinner" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
