'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Upload, FileText, Hash, Lock, ExternalLink, Copy, Check,
  ChevronDown, Trash2, Download, X, AlertTriangle, Fingerprint,
} from 'lucide-react';
import {
  type BitTrustRegistration,
  type TrustTier,
  TRUST_TIER_LABELS,
  TRUST_TIER_COLORS,
  listRegistrations,
  registerIP,
  deleteRegistration,
  updateRegistration,
  buildVerificationReceipt,
  formatFileSize,
} from '@shared/lib/bit-trust';

// --- Helpers ---

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function statusLabel(status: BitTrustRegistration['status']): { text: string; color: string } {
  switch (status) {
    case 'draft': return { text: 'Draft', color: 'text-zinc-500' };
    case 'hashed': return { text: 'Hashed', color: 'text-blue-400' };
    case 'encrypted': return { text: 'Encrypted', color: 'text-purple-400' };
    case 'inscribed': return { text: 'On-Chain', color: 'text-green-400' };
    case 'failed': return { text: 'Failed', color: 'text-red-400' };
    default: return { text: status, color: 'text-zinc-500' };
  }
}

function TierBadge({ tier }: { tier: TrustTier }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border"
      style={{
        color: TRUST_TIER_COLORS[tier],
        borderColor: `${TRUST_TIER_COLORS[tier]}40`,
        backgroundColor: `${TRUST_TIER_COLORS[tier]}10`,
      }}
    >
      <Shield size={10} />
      T{tier} {TRUST_TIER_LABELS[tier]}
    </span>
  );
}

// --- Main Component ---

interface BitTrustPanelProps {
  onInscribe?: (reg: BitTrustRegistration) => Promise<{ txid: string }>;
  onSign?: (reg: BitTrustRegistration) => Promise<{ signature: string; address: string }>;
}

export default function BitTrustPanel({ onInscribe, onSign }: BitTrustPanelProps) {
  const [registrations, setRegistrations] = useState<BitTrustRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await listRegistrations();
      setRegistrations(items);
    } catch (err) {
      console.error('[bit-trust] Failed to load registrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // --- Registration ---

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        await registerIP(file, { encrypt: true });
      }
      await refresh();
    } catch (err) {
      console.error('[bit-trust] Registration failed:', err);
    } finally {
      setProcessing(false);
    }
  }, [refresh]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // --- Actions ---

  const handleDelete = useCallback(async (id: string) => {
    await deleteRegistration(id);
    setExpandedId(null);
    await refresh();
  }, [refresh]);

  const handleInscribe = useCallback(async (reg: BitTrustRegistration) => {
    if (!onInscribe) return;
    setProcessing(true);
    try {
      const { txid } = await onInscribe(reg);
      await updateRegistration(reg.id, { txid, status: 'inscribed' });
      await refresh();
    } catch (err) {
      console.error('[bit-trust] Inscription failed:', err);
      await updateRegistration(reg.id, { status: 'failed' });
      await refresh();
    } finally {
      setProcessing(false);
    }
  }, [onInscribe, refresh]);

  const handleSign = useCallback(async (reg: BitTrustRegistration) => {
    if (!onSign) return;
    setProcessing(true);
    try {
      const { signature, address } = await onSign(reg);
      await updateRegistration(reg.id, {
        signature,
        signerAddress: address,
        signedMessage: `BITTRUST|REGISTER|${reg.contentHash}|AT:${reg.registeredAt}`,
      });
      await refresh();
    } catch (err) {
      console.error('[bit-trust] Signing failed:', err);
    } finally {
      setProcessing(false);
    }
  }, [onSign, refresh]);

  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  }, []);

  const handleDownloadReceipt = useCallback((reg: BitTrustRegistration) => {
    const receipt = buildVerificationReceipt(reg);
    const json = JSON.stringify(receipt, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bittrust-${reg.contentHash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Drop Zone / Register */}
      <div
        className={`mb-4 border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-zinc-800 hover:border-zinc-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
            <Shield size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Register Intellectual Property</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Drop files here or click to browse. Files are hashed (SHA-256) and encrypted (AES-256-GCM) locally.
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Stats */}
      {registrations.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="border border-zinc-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{registrations.length}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Registered</p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{registrations.filter(r => r.status === 'inscribed').length}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">On-Chain</p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{registrations.filter(r => r.signature).length}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Signed</p>
          </div>
        </div>
      )}

      {/* Registration List */}
      {registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield size={32} className="text-zinc-700 mb-4" />
          <p className="text-zinc-500 text-sm mb-1">No IP registrations yet</p>
          <p className="text-zinc-600 text-xs">
            Upload a document, image, or any file to hash and register it.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {registrations.map(reg => {
            const isExpanded = expandedId === reg.id;
            const st = statusLabel(reg.status);

            return (
              <div key={reg.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                {/* Item row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-900/50 transition-colors ${
                    isExpanded ? 'bg-zinc-900/50' : ''
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
                    <Shield size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{reg.name}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-zinc-600">{formatDate(reg.registeredAt)}</span>
                      <span className={st.color}>{st.text}</span>
                      <TierBadge tier={reg.tier} />
                    </div>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 bg-zinc-950 space-y-3">
                    {/* Hash */}
                    <div className="flex items-center gap-2">
                      <Hash size={12} className="text-zinc-500 flex-shrink-0" />
                      <span className="text-xs text-zinc-400 font-mono flex-1 truncate">{reg.contentHash}</span>
                      <button
                        onClick={() => handleCopyHash(reg.contentHash)}
                        className="p-1 text-zinc-500 hover:text-white transition-colors"
                        title="Copy hash"
                      >
                        {copiedHash === reg.contentHash ? (
                          <Check size={12} className="text-green-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-600">File</span>
                        <p className="text-zinc-400 truncate">{reg.fileName}</p>
                      </div>
                      <div>
                        <span className="text-zinc-600">Size</span>
                        <p className="text-zinc-400">{formatFileSize(reg.fileSize)}</p>
                      </div>
                      <div>
                        <span className="text-zinc-600">Type</span>
                        <p className="text-zinc-400">{reg.mimeType}</p>
                      </div>
                      <div>
                        <span className="text-zinc-600">Encryption</span>
                        <p className="text-zinc-400">{reg.encryptedContent ? 'AES-256-GCM' : 'None'}</p>
                      </div>
                      {reg.signerAddress && (
                        <div className="col-span-2">
                          <span className="text-zinc-600">Signer</span>
                          <p className="text-zinc-400 font-mono truncate">{reg.signerAddress}</p>
                        </div>
                      )}
                      {reg.txid && (
                        <div className="col-span-2">
                          <span className="text-zinc-600">TXID</span>
                          <div className="flex items-center gap-1">
                            <p className="text-zinc-400 font-mono truncate flex-1">{reg.txid}</p>
                            <a
                              href={`https://whatsonchain.com/tx/${reg.txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-white transition-colors"
                            >
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {!reg.signature && onSign && (
                        <button
                          onClick={() => handleSign(reg)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Fingerprint size={12} /> Sign
                        </button>
                      )}
                      {reg.status !== 'inscribed' && onInscribe && (
                        <button
                          onClick={() => handleInscribe(reg)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-green-400 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Lock size={12} /> Inscribe
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadReceipt(reg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                      >
                        <Download size={12} /> Receipt
                      </button>
                      <button
                        onClick={() => handleDelete(reg.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Registering IP...</span>
          </div>
        </div>
      )}
    </div>
  );
}
