import React, { useState, useEffect, useCallback } from 'react';

type MasterInfo = { address: string; publicKey: string } | null;
type DerivedChild = { protocol: string; slug: string; address: string; publicKey: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onWalletChanged: () => void;
};

const DEFAULT_DERIVATIONS: Array<{ protocol: string; slug: string }> = [
  { protocol: 'stamp', slug: 'default' },
  { protocol: 'token', slug: 'default' },
  { protocol: 'metanet', slug: 'root' },
  { protocol: 'identity', slug: 'primary' },
];

export default function WalletView({ open, onClose, onWalletChanged }: Props) {
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
      const hasMaster = await window.mint.keystoreHasMaster();
      if (hasMaster) {
        const info = await window.mint.keystoreGetMasterInfo();
        setMasterInfo(info);
        // Derive default addresses
        const children: DerivedChild[] = [];
        for (const d of DEFAULT_DERIVATIONS) {
          try {
            const child = await window.mint.keystoreDeriveAddress(d.protocol, d.slug);
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
    if (open) {
      setError('');
      setSuccess('');
      loadWallet();
    }
  }, [open, loadWallet]);

  const handleCreateWallet = async () => {
    setIsWorking(true);
    setError('');
    try {
      const info = await window.mint.keystoreSetupMaster();
      setMasterInfo(info);
      onWalletChanged();
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
      const data = await window.mint.keystoreExportBackup(backupPassword);
      // Download as file
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

  const handleExportManifest = async () => {
    setIsWorking(true);
    setError('');
    try {
      const manifest = await window.mint.keystoreBuildManifest(DEFAULT_DERIVATIONS);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mint-wallet-manifest-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Manifest downloaded. Contains addresses and derivation paths (no private keys).');
    } catch (err) {
      setError(`Manifest export failed: ${err instanceof Error ? err.message : err}`);
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
      const info = await window.mint.keystoreImportBackup(importData.trim(), importPassword);
      setMasterInfo(info);
      onWalletChanged();
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
      await window.mint.keystoreDeleteMaster();
      setMasterInfo(null);
      setDerivedAddresses([]);
      setShowDeleteConfirm(false);
      onWalletChanged();
      setView('setup');
    } catch (err) {
      setError(`Delete failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsWorking(false);
    }
  };

  const handleImportFile = async () => {
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

  if (!open) return null;

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer wallet-view" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Wallet</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div className="wallet-view-body">
          {error && <div className="wallet-view-error">{error}</div>}
          {success && <div className="wallet-view-success">{success}</div>}

          {/* Loading */}
          {view === 'loading' && (
            <div className="wallet-view-center">
              <div className="wallet-view-spinner" />
            </div>
          )}

          {/* Setup — No wallet yet */}
          {view === 'setup' && (
            <div className="wallet-view-setup">
              <div className="wallet-view-hero">
                <div className="wallet-view-hero-icon">&#x1F511;</div>
                <h3>Create Your Wallet</h3>
                <p>
                  Generate a local master key secured by your OS keychain.
                  All keys are derived deterministically — one master key controls all addresses.
                  No data leaves your machine.
                </p>
              </div>

              <button
                className="wallet-view-primary-btn"
                onClick={handleCreateWallet}
                disabled={isWorking}
              >
                {isWorking ? 'Creating...' : 'Create Local Wallet'}
              </button>

              <div className="wallet-view-divider">
                <span>or</span>
              </div>

              <button
                className="wallet-view-secondary-btn"
                onClick={() => { setView('import'); setError(''); setSuccess(''); }}
              >
                Restore from Backup
              </button>

              <div className="wallet-view-note">
                Your private key is encrypted with your OS keychain (macOS Keychain / Windows DPAPI).
                It never leaves this device.
              </div>
            </div>
          )}

          {/* Import view */}
          {view === 'import' && (
            <div className="wallet-view-import">
              <h3>Restore Wallet</h3>
              <p className="small">Paste your encrypted backup data or load from file.</p>

              <div className="wallet-view-field">
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

              <div className="wallet-view-field">
                <label>Backup Password</label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter password used during export"
                />
              </div>

              <div className="wallet-view-actions">
                <button onClick={handleImportBackup} disabled={isWorking}>
                  {isWorking ? 'Restoring...' : 'Restore Wallet'}
                </button>
                <button className="ghost" onClick={() => { setView('setup'); setError(''); }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Dashboard — Wallet exists */}
          {view === 'dashboard' && masterInfo && (
            <div className="wallet-view-dashboard">
              {/* Master address */}
              <div className="wallet-view-card">
                <div className="wallet-view-card-header">
                  <span className="wallet-view-card-label">Master Address</span>
                  <span className="wallet-view-card-badge connected">Active</span>
                </div>
                <div
                  className="wallet-view-address"
                  onClick={() => copyToClipboard(masterInfo.address, 'master')}
                  title="Click to copy"
                >
                  {masterInfo.address}
                  {copied === 'master' && <span className="wallet-view-copied">Copied</span>}
                </div>
                <div className="wallet-view-pubkey small">
                  PubKey: {masterInfo.publicKey.slice(0, 16)}...{masterInfo.publicKey.slice(-8)}
                </div>
              </div>

              {/* Derived addresses */}
              {derivedAddresses.length > 0 && (
                <div className="wallet-view-section">
                  <h4>Derived Addresses</h4>
                  <div className="wallet-view-derivations">
                    {derivedAddresses.map((child) => (
                      <div
                        key={`${child.protocol}/${child.slug}`}
                        className="wallet-view-derivation-row"
                        onClick={() => copyToClipboard(child.address, `${child.protocol}/${child.slug}`)}
                        title="Click to copy"
                      >
                        <span className="wallet-view-derivation-path">
                          {child.protocol}/{child.slug}
                        </span>
                        <span className="wallet-view-derivation-addr">
                          {child.address.slice(0, 8)}...{child.address.slice(-6)}
                        </span>
                        {copied === `${child.protocol}/${child.slug}` && (
                          <span className="wallet-view-copied">Copied</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="wallet-view-note" style={{ marginTop: 8 }}>
                    Derivation: HMAC-SHA256(masterKey, "bcorp-mint-wallets:protocol/slug")
                  </div>
                </div>
              )}

              {/* Backup section */}
              <div className="wallet-view-section">
                <h4>Backup</h4>
                <div className="wallet-view-backup-fields">
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="Encryption password (min 8 chars)"
                  />
                  <input
                    type="password"
                    value={backupConfirm}
                    onChange={(e) => setBackupConfirm(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                <div className="wallet-view-actions">
                  <button onClick={handleExportBackup} disabled={isWorking || !backupPassword}>
                    {isWorking ? 'Exporting...' : 'Download Encrypted Backup'}
                  </button>
                  <button className="secondary" onClick={handleExportManifest} disabled={isWorking}>
                    Download Manifest (Addresses Only)
                  </button>
                </div>
                <div className="wallet-view-note">
                  Backup = AES-256-GCM encrypted master key. Manifest = addresses + derivation paths (no private keys).
                </div>
              </div>

              {/* Danger zone */}
              <div className="wallet-view-section wallet-view-danger">
                <h4>Danger Zone</h4>
                {!showDeleteConfirm ? (
                  <button className="ghost danger-text" onClick={() => setShowDeleteConfirm(true)}>
                    Delete Wallet from Device
                  </button>
                ) : (
                  <div className="wallet-view-delete-confirm">
                    <p className="small danger-text">
                      This permanently removes your master key from this device.
                      If you haven't backed up, your funds will be lost forever.
                    </p>
                    <div className="wallet-view-actions">
                      <button className="wallet-view-danger-btn" onClick={handleDeleteWallet} disabled={isWorking}>
                        {isWorking ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button className="ghost" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
