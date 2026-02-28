'use client';

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Upload, Hash, ShieldCheck, Wallet, CheckCircle,
  X, ExternalLink, FileText, Copy, Check,
} from 'lucide-react';
import { useAuth } from '@shared/lib/auth-context';
import { useApiClient } from '@shared/lib/api-client';

interface HashedFile {
  filename: string;
  sha256: string;
  size: number;
  timestamp: string;
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HashPage() {
  const [files, setFiles] = useState<HashedFile[]>([]);
  const [hashing, setHashing] = useState(false);
  const [inscribing, setInscribing] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const { handle, login, logout } = useAuth();
  const api = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    setHashing(true);
    setError(null);
    setTxid(null);
    try {
      const newFiles: HashedFile[] = [];
      for (const file of Array.from(fileList)) {
        const sha256 = await hashFile(file);
        newFiles.push({
          filename: file.name,
          sha256,
          size: file.size,
          timestamp: new Date().toISOString(),
        });
      }
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      setError('Failed to hash one or more files');
      console.error(err);
    } finally {
      setHashing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setTxid(null);
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const inscribe = async () => {
    if (!files.length) return;
    setInscribing(true);
    setError(null);
    try {
      const res = await api.post('/api/inscribe', {
        hashes: files.map((f) => ({
          filename: f.filename,
          sha256: f.sha256,
          timestamp: f.timestamp,
        })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inscription failed');
      setTxid(data.txid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription failed');
    } finally {
      setInscribing(false);
    }
  };

  return (
    <div className="main" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
      {/* Left panel — Info */}
      <div className="panel">
        <h2>SHA-256 Hash</h2>
        <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          Drop any file to compute its SHA-256 fingerprint locally.
          The file never leaves your device — only the hash goes on-chain.
        </div>

        <div style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius)',
          background: 'rgba(201, 168, 76, 0.04)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Privacy
            </span>
          </div>
          <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Files are hashed in-browser using the Web Crypto API.
            No data is uploaded, transmitted, or stored.
          </div>
        </div>

        {/* Wallet status */}
        {handle ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(34, 197, 94, 0.15)',
            background: 'rgba(34, 197, 94, 0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="wallet-dot connected" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{handle}</span>
            </div>
            <button className="ghost" onClick={logout} title="Disconnect" style={{ padding: '2px 6px' }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button onClick={login} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 8, width: '100%',
            background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.15), rgba(201, 168, 76, 0.05))',
            border: '1px solid rgba(201, 168, 76, 0.2)',
            color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Wallet size={14} />
            Connect HandCash
          </button>
        )}

        <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 'auto' }}>
          {files.length} file{files.length !== 1 ? 's' : ''} hashed
        </div>
      </div>

      {/* Center panel — Drop zone + results */}
      <div className="panel" style={{ overflow: 'auto' }}>
        <h2>Files</h2>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            position: 'relative',
            cursor: 'pointer',
            borderRadius: 'var(--radius)',
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'rgba(201, 168, 76, 0.12)'}`,
            padding: files.length > 0 ? '16px 20px' : '40px 20px',
            textAlign: 'center',
            transition: 'all 0.2s',
            background: dragOver ? 'rgba(201, 168, 76, 0.04)' : 'transparent',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
          />
          <Upload size={files.length > 0 ? 16 : 28} style={{
            margin: '0 auto', marginBottom: files.length > 0 ? 4 : 12,
            color: dragOver ? 'var(--accent)' : 'var(--muted)',
            transition: 'color 0.2s',
          }} />
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
            {hashing ? 'Hashing...' : 'Drop files here or click to browse'}
          </div>
          {files.length === 0 && (
            <div className="small" style={{ color: 'var(--muted)' }}>
              Any file type accepted
            </div>
          )}
        </div>

        {/* File list */}
        <AnimatePresence>
          {files.map((file, i) => (
            <motion.div
              key={`${file.filename}-${file.sha256}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.03 }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(201, 168, 76, 0.06)',
                background: 'rgba(201, 168, 76, 0.02)',
              }}
            >
              <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.filename}
                  </span>
                  <span className="small" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    {formatSize(file.size)}
                  </span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <code style={{
                    fontSize: 10, color: 'var(--accent)', opacity: 0.7,
                    fontFamily: "'IBM Plex Mono', monospace",
                    wordBreak: 'break-all', lineHeight: 1.5,
                  }}>
                    {file.sha256}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyHash(file.sha256); }}
                    className="ghost"
                    style={{ padding: 2, flexShrink: 0 }}
                    title="Copy hash"
                  >
                    {copiedHash === file.sha256
                      ? <Check size={11} style={{ color: '#22c55e' }} />
                      : <Copy size={11} style={{ color: 'var(--muted)' }} />
                    }
                  </button>
                </div>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="ghost"
                style={{ padding: 2, flexShrink: 0, opacity: 0.4 }}
                title="Remove"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {files.length === 0 && !hashing && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Hash size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
            <div className="small" style={{ color: 'var(--muted)' }}>
              No files hashed yet
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Inscribe */}
      <div className="panel">
        <h2>Inscribe</h2>

        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <ShieldCheck size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
            <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Hash files first, then inscribe the proof to BSV.
            </div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div style={{
              padding: '12px 14px', borderRadius: 8,
              border: '1px solid rgba(201, 168, 76, 0.08)',
              background: 'rgba(201, 168, 76, 0.03)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="small" style={{ color: 'var(--muted)' }}>Files</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{files.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="small" style={{ color: 'var(--muted)' }}>Format</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace" }}>BCORP_IP_HASH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="small" style={{ color: 'var(--muted)' }}>Network</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>BSV Mainnet</span>
              </div>
            </div>

            {/* Inscribe button */}
            {!handle ? (
              <button onClick={login} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 16px', borderRadius: 8, width: '100%',
                background: 'linear-gradient(135deg, #c9a84c, #e6c665)',
                border: 'none', color: '#000', fontSize: 12, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.12em', cursor: 'pointer',
              }}>
                <Wallet size={14} />
                Connect to Inscribe
              </button>
            ) : (
              <button onClick={inscribe} disabled={inscribing} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 16px', borderRadius: 8, width: '100%',
                background: inscribing ? '#222' : 'linear-gradient(135deg, #c9a84c, #e6c665)',
                border: 'none', color: inscribing ? '#666' : '#000', fontSize: 12, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                cursor: inscribing ? 'wait' : 'pointer',
                boxShadow: inscribing ? 'none' : '0 4px 16px rgba(201, 168, 76, 0.2)',
              }}>
                <Hash size={14} />
                {inscribing ? 'Inscribing...' : `Inscribe ${files.length} Hash${files.length !== 1 ? 'es' : ''}`}
              </button>
            )}

            {/* Clear all */}
            <button
              onClick={() => { setFiles([]); setTxid(null); }}
              className="ghost"
              style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', width: '100%', padding: '6px 0' }}
            >
              Clear all
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.2)',
            background: 'rgba(239, 68, 68, 0.05)',
            fontSize: 11, color: '#ef4444',
          }}>
            {error}
          </div>
        )}

        {/* Success */}
        {txid && (
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            border: '1px solid rgba(34, 197, 94, 0.2)',
            background: 'rgba(34, 197, 94, 0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <CheckCircle size={14} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>Inscribed on BSV</span>
            </div>
            <a
              href={`https://whatsonchain.com/tx/${txid}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, color: 'var(--accent)',
                fontFamily: "'IBM Plex Mono', monospace",
                wordBreak: 'break-all', lineHeight: 1.5,
                textDecoration: 'none',
              }}
            >
              {txid}
              <ExternalLink size={10} style={{ flexShrink: 0 }} />
            </a>
          </div>
        )}

        {/* OP_RETURN preview */}
        <div style={{ marginTop: 'auto' }}>
          <div className="small" style={{ fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            On-chain format
          </div>
          <code style={{
            display: 'block', fontSize: 9, color: 'var(--accent)', opacity: 0.5,
            fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6,
            wordBreak: 'break-all',
          }}>
            BCORP_IP_HASH | ts:&lt;iso&gt; | file:&lt;sha256&gt;
          </code>
        </div>
      </div>
    </div>
  );
}
