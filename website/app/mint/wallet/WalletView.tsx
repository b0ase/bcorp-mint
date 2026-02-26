'use client';

import { useState, useEffect, useCallback } from 'react';
import * as bridge from '../../../lib/mint-bridge';

type MasterInfo = { address: string; publicKey: string } | null;
type DerivedChild = { protocol: string; slug: string; address: string; publicKey: string };

const DEFAULT_DERIVATIONS: Array<{ protocol: string; slug: string }> = [
  { protocol: 'stamp', slug: 'default' },
  { protocol: 'token', slug: 'default' },
  { protocol: 'identity', slug: 'primary' },
];

export default function WalletView() {
  const [view, setView] = useState<'loading' | 'setup' | 'dashboard' | 'import'>('loading');
  const [masterInfo, setMasterInfo] = useState<MasterInfo>(null);
  const [derivedAddresses, setDerivedAddresses] = useState<DerivedChild[]>([]);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupConfirm, setBackupConfirm] = useState('');
  const [importData, setImportData] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      const hasMaster = await bridge.keystoreHasMaster();
      if (hasMaster) {
        const info = await bridge.keystoreGetMasterInfo();
        setMasterInfo(info);
        const children: DerivedChild[] = [];
        for (const d of DEFAULT_DERIVATIONS) {
          try {
            const child = await bridge.keystoreDeriveAddress(d.protocol, d.slug);
            children.push(child);
          } catch { /* skip */ }
        }
        setDerivedAddresses(children);
        setView('dashboard');
      } else {
        setView('setup');
      }
    } catch (err) {
      console.error('[WalletView] load failed:', err);
      setView('setup');
    }
  }, []);

  useEffect(() => {
    setError('');
    setSuccess('');
    loadWallet();
  }, [loadWallet]);

  const handleCreateWallet = async () => {
    setIsWorking(true);
    setError('');
    try {
      const info = await bridge.keystoreSetupMaster();
      setMasterInfo(info);
      await loadWallet();
      setSuccess('Wallet created. Back up your wallet immediately.');
    } catch (err) {
      setError(`Failed to create wallet: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleExportBackup = async () => {
    if (!backupPassword || backupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (backupPassword !== backupConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setIsWorking(true);
    setError('');
    try {
      const data = await bridge.keystoreExportBackup(backupPassword);
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mint-wallet-backup-${Date.now()}.enc`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Backup downloaded. Store it safely.');
      setBackupPassword('');
      setBackupConfirm('');
    } catch (err) {
      setError(`Backup failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleImportBackup = async () => {
    if (!importData.trim() || !importPassword) {
      setError('Paste your backup data and enter the password.');
      return;
    }
    setIsWorking(true);
    setError('');
    try {
      const info = await bridge.keystoreImportBackup(importData.trim(), importPassword);
      setMasterInfo(info);
      setImportData('');
      setImportPassword('');
      await loadWallet();
      setSuccess('Wallet restored from backup.');
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteWallet = async () => {
    setIsWorking(true);
    setError('');
    try {
      await bridge.keystoreDeleteMaster();
      setMasterInfo(null);
      setDerivedAddresses([]);
      setShowDeleteConfirm(false);
      setView('setup');
    } catch (err) {
      setError(`Delete failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.enc,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      setImportData(text.trim());
    };
    input.click();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mint-wallet-page">
      <div className="mint-wallet-card">
        <h2>Wallet</h2>

        {error && <div className="mint-wallet-error">{error}</div>}
        {success && <div className="mint-wallet-success">{success}</div>}

        {view === 'loading' && (
          <div className="mint-wallet-center">
            <p>Loading wallet...</p>
          </div>
        )}

        {view === 'setup' && (
          <div className="mint-wallet-setup">
            <div className="mint-wallet-hero">
              <h3>Create Your Wallet</h3>
              <p>
                Generate a local master key stored in your browser.
                All keys are derived deterministically — one master key controls all addresses.
                No data leaves your machine.
              </p>
            </div>

            <button
              className="mint-primary-btn"
              onClick={handleCreateWallet}
              disabled={isWorking}
            >
              {isWorking ? 'Creating...' : 'Create Local Wallet'}
            </button>

            <div className="mint-wallet-divider"><span>or</span></div>

            <button
              className="secondary"
              onClick={() => { setView('import'); setError(''); setSuccess(''); }}
            >
              Restore from Backup
            </button>

            <p className="small" style={{ marginTop: 16, opacity: 0.6 }}>
              Your private key is encrypted with AES-256-GCM and stored in IndexedDB.
              It never leaves this device.
            </p>
          </div>
        )}

        {view === 'import' && (
          <div className="mint-wallet-import">
            <h3>Restore Wallet</h3>
            <p className="small">Paste your encrypted backup data or load from file.</p>

            <div className="mint-wallet-field">
              <label>Backup Data</label>
              <textarea
                rows={4}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste encrypted backup string..."
              />
              <button className="ghost" onClick={handleImportFile} style={{ marginTop: 4 }}>
                Load from File
              </button>
            </div>

            <div className="mint-wallet-field">
              <label>Backup Password</label>
              <input
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Enter password used during export"
              />
            </div>

            <div className="mint-wallet-actions">
              <button onClick={handleImportBackup} disabled={isWorking}>
                {isWorking ? 'Restoring...' : 'Restore Wallet'}
              </button>
              <button className="ghost" onClick={() => { setView('setup'); setError(''); }}>
                Back
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' && masterInfo && (
          <div className="mint-wallet-dashboard">
            <div className="mint-wallet-section">
              <div className="mint-wallet-section-header">
                <span>Master Address</span>
                <span className="mint-wallet-badge">Active</span>
              </div>
              <div
                className="mint-wallet-address"
                onClick={() => copyToClipboard(masterInfo.address, 'master')}
                title="Click to copy"
              >
                <code>{masterInfo.address}</code>
                {copied === 'master' && <span className="mint-copied">Copied</span>}
              </div>
              <div className="small" style={{ opacity: 0.5, marginTop: 4 }}>
                PubKey: {masterInfo.publicKey.slice(0, 16)}...{masterInfo.publicKey.slice(-8)}
              </div>
            </div>

            {derivedAddresses.length > 0 && (
              <div className="mint-wallet-section">
                <h4>Derived Addresses</h4>
                <div className="mint-wallet-derivations">
                  {derivedAddresses.map((child) => (
                    <div
                      key={`${child.protocol}/${child.slug}`}
                      className="mint-wallet-derivation"
                      onClick={() => copyToClipboard(child.address, `${child.protocol}/${child.slug}`)}
                      title="Click to copy"
                    >
                      <span className="mint-derivation-path">{child.protocol}/{child.slug}</span>
                      <code className="mint-derivation-addr">
                        {child.address.slice(0, 8)}...{child.address.slice(-6)}
                      </code>
                      {copied === `${child.protocol}/${child.slug}` && (
                        <span className="mint-copied">Copied</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mint-wallet-section">
              <h4>Backup</h4>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Encryption password (min 8 chars)"
                style={{ marginBottom: 8 }}
              />
              <input
                type="password"
                value={backupConfirm}
                onChange={(e) => setBackupConfirm(e.target.value)}
                placeholder="Confirm password"
                style={{ marginBottom: 8 }}
              />
              <button className="secondary" onClick={handleExportBackup} disabled={isWorking || !backupPassword}>
                {isWorking ? 'Exporting...' : 'Download Encrypted Backup'}
              </button>
              <p className="small" style={{ marginTop: 8, opacity: 0.5 }}>
                Backup = AES-256-GCM encrypted master key.
              </p>
            </div>

            <div className="mint-wallet-section mint-wallet-danger">
              <h4>Danger Zone</h4>
              {!showDeleteConfirm ? (
                <button className="ghost" style={{ color: '#ef4444' }} onClick={() => setShowDeleteConfirm(true)}>
                  Delete Wallet from Device
                </button>
              ) : (
                <div>
                  <p className="small" style={{ color: '#ef4444', marginBottom: 8 }}>
                    This permanently removes your master key from this device.
                    If you have not backed up, your funds will be lost forever.
                  </p>
                  <div className="mint-wallet-actions">
                    <button style={{ background: '#ef4444', color: '#fff' }} onClick={handleDeleteWallet} disabled={isWorking}>
                      {isWorking ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button className="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
