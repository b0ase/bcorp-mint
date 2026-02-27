'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  listCloudEntries,
  downloadFromCloud,
  deleteFromCloud,
  decryptBundle,
  exportBundleFile,
  importBundleFile,
} from '@shared/lib/cloud-vault';
import type { EncryptedBundle } from '@shared/lib/types';

type CloudEntry = {
  id: string;
  name: string;
  assetType: string;
  createdAt: string;
};

type Props = {
  signMessage: ((message: string) => Promise<{ signature: string; address: string }>) | null;
  onRestore: (docJson: string) => void;
  onClose: () => void;
};

export default function CloudVaultBrowser({ signMessage, onRestore, onClose }: Props) {
  const [entries, setEntries] = useState<CloudEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listCloudEntries();
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cloud vault');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRestore = async (entry: CloudEntry) => {
    if (!signMessage) {
      setError('Wallet required to decrypt cloud entries.');
      return;
    }
    setStatus(`Downloading ${entry.name}...`);
    try {
      const bundle = await downloadFromCloud(entry.id);
      setStatus('Decrypting...');
      const docJson = await decryptBundle(bundle, signMessage);
      setStatus('');
      onRestore(docJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setStatus('');
    }
  };

  const handleDownload = async (entry: CloudEntry) => {
    setStatus(`Downloading ${entry.name}...`);
    try {
      const bundle = await downloadFromCloud(entry.id);
      exportBundleFile(bundle);
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setStatus('');
    }
  };

  const handleDelete = async (entry: CloudEntry) => {
    if (!confirm(`Delete "${entry.name}" from cloud? This cannot be undone.`)) return;
    try {
      await deleteFromCloud(entry.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleImportFile = async () => {
    if (!signMessage) {
      setError('Wallet required to decrypt .mint files.');
      return;
    }
    try {
      const bundle = await importBundleFile();
      setStatus('Decrypting...');
      const docJson = await decryptBundle(bundle, signMessage);
      setStatus('');
      onRestore(docJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStatus('');
    }
  };

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer cloud-vault-browser" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Cloud Vault</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="secondary" onClick={handleImportFile} style={{ fontSize: 12 }}>
              Import .mint File
            </button>
            <button className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {error && <div className="wallet-view-error" style={{ marginBottom: 10 }}>{error}</div>}
          {status && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 10 }}>{status}</div>}

          {loading ? (
            <div className="portfolio-empty">Loading cloud vault...</div>
          ) : entries.length === 0 ? (
            <div className="portfolio-empty">
              No cloud saves yet. Use &ldquo;Save to Cloud&rdquo; in the Vault panel to get started.
            </div>
          ) : (
            <div className="cloud-entry-list">
              {entries.map(entry => (
                <div key={entry.id} className="cloud-entry-card">
                  <div className="cloud-entry-info">
                    <div className="cloud-entry-name">{entry.name || 'Untitled'}</div>
                    <div className="cloud-entry-meta">
                      <span className={`asset-type-badge ${entry.assetType}`}>{entry.assetType}</span>
                      <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="cloud-entry-actions">
                    <button
                      className="secondary"
                      onClick={() => handleRestore(entry)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      Restore
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleDownload(entry)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      Download
                    </button>
                    <button
                      className="ghost"
                      onClick={() => handleDelete(entry)}
                      style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
