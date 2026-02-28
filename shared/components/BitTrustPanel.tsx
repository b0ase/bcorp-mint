'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Hash, Lock, ExternalLink, Copy, Check, Link2,
  ChevronDown, Trash2, Download, AlertTriangle, Fingerprint,
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

// --- Types ---

interface Identity {
  id: string;
  user_handle: string;
  token_id: string;
  identity_strength: number;
  avatar_url?: string;
}

interface IPThread {
  id: string;
  title: string;
  documentHash: string;
  documentType: string;
  sequence: number;
  txid: string;
  createdAt: string;
}

interface ApiClient {
  get: (path: string, opts?: RequestInit) => Promise<Response>;
  post: (path: string, body?: unknown, opts?: RequestInit) => Promise<Response>;
}

// --- Helpers ---

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

/** Map $401 identity level to maximum allowed Bit Trust tier */
function maxTierForIdentityLevel(level: number): TrustTier {
  if (level >= 4) return 5;
  if (level >= 3) return 4;
  if (level >= 2) return 3;
  return 1;
}

function identityLevelLabel(level: number): { label: string; color: string } {
  if (level >= 4) return { label: 'Sovereign', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
  if (level >= 3) return { label: 'Strong', color: 'text-green-400 border-green-500/30 bg-green-500/10' };
  if (level >= 2) return { label: 'Verified', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
  return { label: 'Basic', color: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10' };
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
  /** $401 identity (from bit-sign API) */
  identity?: Identity | null;
  /** Authenticated user handle */
  handle?: string | null;
  /** API client for bit-sign calls */
  api?: ApiClient | null;
  /** Local wallet inscription callback */
  onInscribe?: (reg: BitTrustRegistration) => Promise<{ txid: string }>;
  /** Local wallet signing callback */
  onSign?: (reg: BitTrustRegistration) => Promise<{ signature: string; address: string }>;
}

export default function BitTrustPanel({ identity, handle, api, onInscribe, onSign }: BitTrustPanelProps) {
  const [registrations, setRegistrations] = useState<BitTrustRegistration[]>([]);
  const [ipThreads, setIpThreads] = useState<IPThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('Registering IP...');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxTier = identity ? maxTierForIdentityLevel(identity.identity_strength) : 1;

  // --- Data Fetching ---

  const fetchIPThreads = useCallback(async () => {
    if (!api || !handle) return;
    try {
      const res = await api.get('/api/bitsign/ip-thread');
      if (res.ok) {
        const data = await res.json();
        setIpThreads(data.threads || []);
      }
    } catch (err) {
      console.error('[bit-trust] Failed to fetch IP threads:', err);
    }
  }, [api, handle]);

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

  useEffect(() => {
    refresh();
    fetchIPThreads();
  }, [refresh, fetchIPThreads]);

  // --- Registration ---

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setProcessing(true);
    setProcessingLabel('Hashing & encrypting...');
    try {
      for (const file of Array.from(files)) {
        const reg = await registerIP(file, { encrypt: true });

        // Auto-link $401 identity if available
        if (identity?.token_id) {
          await updateRegistration(reg.id, { identityRef: identity.token_id });
        }

        // Auto-register as IP thread on bit-sign if authenticated
        if (api && handle && identity) {
          setProcessingLabel('Registering IP thread on-chain...');
          try {
            const res = await api.post('/api/bitsign/ip-thread', {
              documentHash: reg.contentHash,
              title: reg.name,
              description: `Bit Trust registration: ${reg.fileName} (${formatFileSize(reg.fileSize)})`,
            });
            if (res.ok) {
              const data = await res.json();
              // Update local registration with on-chain strand info
              await updateRegistration(reg.id, {
                txid: data.inscriptionTxid || data.strandTxid || null,
                status: data.inscriptionTxid ? 'inscribed' : reg.status,
                identityRef: identity.token_id,
              });
            }
          } catch (err) {
            console.warn('[bit-trust] IP thread registration failed (non-fatal):', err);
          }
        }
      }
      await refresh();
      await fetchIPThreads();
    } catch (err) {
      console.error('[bit-trust] Registration failed:', err);
    } finally {
      setProcessing(false);
    }
  }, [refresh, fetchIPThreads, identity, api, handle]);

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
    setProcessingLabel('Inscribing to BSV...');
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
    setProcessingLabel('Signing registration...');
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

  const handleLinkIdentity = useCallback(async (reg: BitTrustRegistration) => {
    if (!api || !handle || !identity) return;
    setProcessing(true);
    setProcessingLabel('Linking to $401 identity...');
    try {
      const res = await api.post('/api/bitsign/ip-thread', {
        documentHash: reg.contentHash,
        title: reg.name,
        description: `Bit Trust registration: ${reg.fileName}`,
      });
      if (res.ok) {
        const data = await res.json();
        await updateRegistration(reg.id, {
          identityRef: identity.token_id,
          txid: data.inscriptionTxid || data.strandTxid || reg.txid,
          status: data.inscriptionTxid ? 'inscribed' : reg.status,
        });
        await refresh();
        await fetchIPThreads();
      } else {
        const err = await res.json();
        console.error('[bit-trust] Link failed:', err.error);
      }
    } catch (err) {
      console.error('[bit-trust] Link identity failed:', err);
    } finally {
      setProcessing(false);
    }
  }, [api, handle, identity, refresh, fetchIPThreads]);

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
      {/* Identity Status Banner */}
      {identity ? (
        <div className="mb-4 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          {identity.avatar_url ? (
            <img src={identity.avatar_url} alt="" className="w-8 h-8 rounded-full border border-zinc-700" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
              {(handle || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">${handle}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${identityLevelLabel(identity.identity_strength).color}`}>
                <Shield size={10} />
                Lv.{identity.identity_strength} {identityLevelLabel(identity.identity_strength).label}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              $401 identity linked. Max trust tier: T{maxTier} ({TRUST_TIER_LABELS[maxTier]})
            </p>
          </div>
          {identity.token_id && (
            <a
              href={`https://whatsonchain.com/tx/${identity.token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-500 hover:text-white transition-colors"
              title="View $401 identity on-chain"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      ) : handle ? (
        <div className="mb-4 border border-amber-500/30 bg-amber-500/5 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-amber-300 font-medium">No $401 identity minted</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Registrations will be Tier 1 (Self-Signed) only. Mint your identity on the Identity tab to unlock higher trust tiers.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          <Shield size={16} className="text-zinc-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-zinc-400">Not signed in</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Files are hashed and encrypted locally. Sign in to link registrations to your $401 identity.
            </p>
          </div>
        </div>
      )}

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
              {identity
                ? 'Drop files to hash, encrypt, and register as $401 IP thread on-chain.'
                : 'Drop files here or click to browse. Files are hashed (SHA-256) and encrypted (AES-256-GCM) locally.'}
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
      {(registrations.length > 0 || ipThreads.length > 0) && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="border border-zinc-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{registrations.length}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Local</p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{ipThreads.length}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">$401 Threads</p>
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

      {/* Server-side IP Threads (from $401 identity) */}
      {ipThreads.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2">$401 IP Threads</p>
          <div className="space-y-1">
            {ipThreads.map(thread => (
              <div key={thread.id} className="flex items-center gap-3 px-3 py-2 border border-zinc-800 rounded-lg">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                  #{thread.sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{thread.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                    <span>{formatDate(thread.createdAt)}</span>
                    <span className="text-green-600">{thread.txid ? 'On-chain' : ''}</span>
                  </div>
                </div>
                {thread.txid && (
                  <a
                    href={`https://whatsonchain.com/tx/${thread.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-500 hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Registration List */}
      {registrations.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2">Local Registrations</p>
        </div>
      )}

      {registrations.length === 0 && ipThreads.length === 0 ? (
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
            const isLinked = !!reg.identityRef;

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
                    <div className="flex items-center gap-2 text-[10px] flex-wrap">
                      <span className="text-zinc-600">{formatDate(reg.registeredAt)}</span>
                      <span className={st.color}>{st.text}</span>
                      <TierBadge tier={reg.tier} />
                      {isLinked && (
                        <span className="text-blue-400 flex items-center gap-0.5">
                          <Link2 size={8} /> $401
                        </span>
                      )}
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
                      {reg.identityRef && (
                        <div className="col-span-2">
                          <span className="text-zinc-600">$401 Identity</span>
                          <div className="flex items-center gap-1">
                            <p className="text-blue-400 font-mono truncate flex-1">{reg.identityRef}</p>
                            <a
                              href={`https://whatsonchain.com/tx/${reg.identityRef}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-white transition-colors"
                            >
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      )}
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
                      {!reg.identityRef && identity && api && (
                        <button
                          onClick={() => handleLinkIdentity(reg)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Link2 size={12} /> Link $401
                        </button>
                      )}
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
            <span className="text-sm">{processingLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
