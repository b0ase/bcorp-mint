'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Lock, LogIn, PenTool, Camera, FileUp, Video, Trash2,
  ChevronDown, X, Download, ExternalLink, Shield, Eye,
  MoreVertical, RotateCcw, AlertTriangle, Send, Users,
  FileText, Image as ImageIcon, Stamp, Inbox, ArrowLeft,
  Share2, Copy, Check, Upload, Wallet
} from 'lucide-react';
import SovereignSignature from '@shared/components/SovereignSignature';
import MediaCapture from '@shared/components/MediaCapture';
import BitTrustPanel from '@shared/components/BitTrustPanel';
import DocumentCanvas, { type PlacedElement } from '@shared/components/DocumentCanvas';
import ShareModal from '@shared/components/ShareModal';
import WalletSigningModal from '@shared/components/WalletSigningModal';
import { useToast } from '@shared/components/Toast';
import { useAuth } from '@shared/lib/auth-context';
import { useApiClient } from '@shared/lib/api-client';

// --- Types ---

interface Signature {
  id: string;
  signature_type: string;
  payload_hash: string;
  txid: string | null;
  created_at: string;
  metadata: Record<string, any>;
  wallet_signed?: boolean;
  wallet_signature?: string;
  wallet_address?: string;
  encryption_version?: number;
  deleted_at?: string | null;
  iv?: string | null;
}

interface Identity {
  id: string;
  user_handle: string;
  token_id: string;
  identity_strength: number;
  metadata: Record<string, any>;
  avatar_url?: string;
  registered_signature_id?: string;
}

interface Strand {
  id: string;
  strand_type: string;
  strand_subtype?: string;
  strand_txid?: string;
  label?: string;
  signature_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

// --- Helpers ---

type VaultTab = 'all' | 'documents' | 'sealed' | 'signatures' | 'media' | 'received' | 'sent' | 'ip-vault' | 'trash';

const VAULT_TABS: { key: VaultTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'documents', label: 'Documents' },
  { key: 'sealed', label: 'Sealed' },
  { key: 'signatures', label: 'Signatures' },
  { key: 'media', label: 'Media' },
  { key: 'ip-vault', label: 'IP Vault' },
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
  { key: 'trash', label: 'Trash' },
];

function getItemIcon(type: string) {
  switch (type) {
    case 'TLDRAW': case 'TYPED': return PenTool;
    case 'DOCUMENT': case 'PDF': return FileText;
    case 'SEALED_DOCUMENT': return Stamp;
    case 'PHOTO': case 'IMAGE': return ImageIcon;
    case 'VIDEO': return Video;
    default: return FileText;
  }
}

function getItemLabel(sig: Signature): string {
  if (sig.metadata?.fileName) return sig.metadata.fileName;
  if (sig.metadata?.originalFileName) return sig.metadata.originalFileName;
  switch (sig.signature_type) {
    case 'TLDRAW': return 'Drawn Signature';
    case 'TYPED': return 'Typed Signature';
    case 'SEALED_DOCUMENT': return sig.metadata?.originalFileName || 'Sealed Document';
    case 'PHOTO': case 'IMAGE': return 'Photo';
    case 'VIDEO': return 'Video';
    case 'DOCUMENT': case 'PDF': return 'Document';
    default: return sig.signature_type;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function resolveDocName(sig: Signature): string {
  const name = sig.metadata?.fileName || sig.metadata?.originalFileName;
  if (name && name !== 'Sealed Document') return name;
  return sig.signature_type === 'SEALED_DOCUMENT' ? 'Sealed Document' : getItemLabel(sig);
}

// --- Main Component ---

interface VaultPageProps {
  pdfToImageFn?: (arrayBuffer: ArrayBuffer) => Promise<{ blob: Blob; numPages: number }>;
}

export default function VaultPage({ pdfToImageFn }: VaultPageProps = {}) {
  const { handle, loading: authLoading, login } = useAuth();
  const api = useApiClient();
  const { toast: addToast } = useToast();

  // Data state
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [trashItems, setTrashItems] = useState<Signature[]>([]);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [strands, setStrands] = useState<Strand[]>([]);
  const [registeredSigSvg, setRegisteredSigSvg] = useState<string | null>(null);

  // UI state
  const [vaultTab, setVaultTab] = useState<VaultTab>('all');
  const [expandedSig, setExpandedSig] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);

  // Modal state
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'PHOTO' | 'VIDEO' | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState<string | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalTarget, setWalletModalTarget] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  // Document signing state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocBlob, setSelectedDocBlob] = useState<string | null>(null);
  const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Data Fetching ---
  const fetchData = useCallback(async (userHandle: string) => {
    try {
      const res = await api.get(`/api/bitsign/signatures?handle=${userHandle}`);
      if (!res.ok) throw new Error('Failed to load vault');
      const data = await res.json();
      setSignatures(data.signatures || []);
      setIdentity(data.identity || null);
      setStrands(data.strands || []);
    } catch (err) {
      console.error('[vault] fetch error:', err);
      addToast('Failed to load vault data', 'error');
    }
  }, [api, addToast]);

  const fetchTrash = useCallback(async (userHandle: string) => {
    try {
      const res = await api.get(`/api/bitsign/signatures?handle=${userHandle}&trash=true`);
      if (!res.ok) return;
      const data = await res.json();
      setTrashItems(data.signatures || []);
    } catch (err) {
      console.error('[vault] trash fetch error:', err);
    }
  }, [api]);

  const fetchRegisteredSig = useCallback(async () => {
    try {
      const res = await api.get('/api/bitsign/registered-signature');
      if (!res.ok) return;
      const data = await res.json();
      setRegisteredSigSvg(data.svg || null);
    } catch { /* silent */ }
  }, [api]);

  useEffect(() => {
    if (!handle) return;
    fetchData(handle);
    fetchTrash(handle);
    fetchRegisteredSig();
  }, [handle, fetchData, fetchTrash, fetchRegisteredSig]);

  // --- Filtered items ---
  const filteredItems = useMemo(() => {
    if (vaultTab === 'trash') return trashItems;

    return signatures.filter(sig => {
      switch (vaultTab) {
        case 'all': return true;
        case 'documents':
          return ['DOCUMENT', 'PDF'].includes(sig.signature_type);
        case 'sealed':
          return sig.signature_type === 'SEALED_DOCUMENT';
        case 'signatures':
          return ['TLDRAW', 'TYPED'].includes(sig.signature_type);
        case 'media':
          return ['PHOTO', 'IMAGE', 'VIDEO'].includes(sig.signature_type);
        case 'received':
          return sig.metadata?.shared || sig.metadata?.coSigned;
        case 'sent':
          return sig.metadata?.sentTo;
        default: return true;
      }
    });
  }, [signatures, trashItems, vaultTab]);

  // --- Preview ---
  const previewItem = useCallback(async (sigId: string) => {
    if (expandedSig === sigId) {
      setExpandedSig(null);
      setPreviewData(null);
      return;
    }
    setExpandedSig(sigId);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await api.get(`/api/bitsign/signatures/${sigId}/preview`);
      if (!res.ok) throw new Error('Preview failed');
      const data = await res.json();
      setPreviewData(data.data || data.url || null);
    } catch (err) {
      addToast('Failed to load preview', 'error');
    } finally {
      setPreviewLoading(false);
    }
  }, [expandedSig, api, addToast]);

  // --- Upload ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !handle) return;
    setIsProcessing(true);

    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        let imageData = base64;
        let sigType = 'DOCUMENT';
        let numPages = 1;

        if (file.type === 'application/pdf') {
          sigType = 'PDF';
          if (typeof window !== 'undefined' && pdfToImageFn) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              const result = await pdfToImageFn(arrayBuffer);
              numPages = result.numPages;

              const pdfReader = new FileReader();
              imageData = await new Promise<string>((resolve, reject) => {
                pdfReader.onload = () => resolve(pdfReader.result as string);
                pdfReader.onerror = reject;
                pdfReader.readAsDataURL(result.blob);
              });
            } catch {
              // pdf-to-image failed — upload raw PDF
            }
          }
        } else if (file.type.startsWith('image/')) {
          sigType = 'IMAGE';
        } else if (file.type.startsWith('video/')) {
          sigType = 'VIDEO';
        }

        const rawBase64 = imageData.replace(/^data:[^;]+;base64,/, '');
        const res = await api.post('/api/bitsign/inscribe', {
          signatureType: sigType,
          payload: rawBase64,
          metadata: {
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            numPages: numPages > 1 ? numPages : undefined,
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }

        addToast(`Uploaded: ${file.name}`, 'success');
      }

      fetchData(handle);
    } catch (err: any) {
      console.error('[vault] upload error:', err);
      addToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [handle, api, fetchData, addToast]);

  // --- Signature creation callback ---
  const handleSignatureSave = useCallback(async (signatureData: { svg: string; json: string }) => {
    setSignatureModalOpen(false);
    if (!handle) return;

    try {
      const svgBase64 = btoa(unescape(encodeURIComponent(signatureData.svg)));
      const res = await api.post('/api/bitsign/inscribe', {
        signatureType: 'TLDRAW',
        payload: svgBase64,
        metadata: {
          mimeType: 'image/svg+xml',
          json: signatureData.json,
        },
      });
      if (!res.ok) throw new Error('Failed to save signature');
      addToast('Signature saved to vault', 'success');
      fetchData(handle);
    } catch (err: any) {
      addToast(err.message || 'Failed to save signature', 'error');
    }
  }, [handle, api, fetchData, addToast]);

  // --- Media capture callback ---
  const handleMediaCapture = useCallback(async (blob: Blob) => {
    if (!handle) return;
    setCaptureMode(null);
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const rawBase64 = base64.replace(/^data:[^;]+;base64,/, '');
      const isVideo = blob.type.startsWith('video/');

      const res = await api.post('/api/bitsign/inscribe', {
        signatureType: isVideo ? 'VIDEO' : 'PHOTO',
        payload: rawBase64,
        metadata: {
          mimeType: blob.type,
          size: blob.size,
          capturedAt: new Date().toISOString(),
        },
      });

      if (!res.ok) throw new Error('Capture save failed');
      addToast(isVideo ? 'Video saved to vault' : 'Photo saved to vault', 'success');
      fetchData(handle);
    } catch (err: any) {
      addToast(err.message || 'Failed to save capture', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [handle, api, fetchData, addToast]);

  // --- Delete / Restore ---
  const deleteItem = useCallback(async (sigId: string) => {
    try {
      const res = await api.del(`/api/bitsign/signatures/${sigId}/delete`);
      if (!res.ok) throw new Error('Delete failed');
      addToast('Moved to trash', 'info');
      if (handle) {
        fetchData(handle);
        fetchTrash(handle);
      }
      if (expandedSig === sigId) {
        setExpandedSig(null);
        setPreviewData(null);
      }
    } catch (err: any) {
      addToast(err.message || 'Delete failed', 'error');
    }
    setContextMenu(null);
  }, [handle, expandedSig, api, fetchData, fetchTrash, addToast]);

  const restoreItem = useCallback(async (sigId: string) => {
    try {
      const res = await api.patch(`/api/bitsign/signatures/${sigId}/delete`);
      if (!res.ok) throw new Error('Restore failed');
      addToast('Restored from trash', 'success');
      if (handle) {
        fetchData(handle);
        fetchTrash(handle);
      }
    } catch (err: any) {
      addToast(err.message || 'Restore failed', 'error');
    }
  }, [handle, api, fetchData, fetchTrash, addToast]);

  // --- Seal document ---
  const handleSeal = useCallback(async (compositeBase64: string, elements: PlacedElement[]) => {
    if (!selectedDocId || !handle) return;
    setIsProcessing(true);

    try {
      const res = await api.post('/api/bitsign/seal', {
        originalDocumentId: selectedDocId,
        compositeData: compositeBase64,
        elements,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Seal failed');
      }

      const result = await res.json();
      addToast(`Document sealed! TXID: ${result.txid?.slice(0, 12)}...`, 'success');
      setSelectedDocId(null);
      setSelectedDocBlob(null);
      setPlacedElements([]);
      fetchData(handle);
    } catch (err: any) {
      addToast(err.message || 'Failed to seal document', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedDocId, handle, api, fetchData, addToast]);

  // --- Open document for signing ---
  const openDocInCanvas = useCallback(async (sigId: string) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/api/bitsign/signatures/${sigId}/preview`);
      if (!res.ok) throw new Error('Failed to load document');
      const data = await res.json();
      setSelectedDocId(sigId);
      setSelectedDocBlob(data.data || data.url);
    } catch (err: any) {
      addToast(err.message || 'Failed to open document', 'error');
    } finally {
      setPreviewLoading(false);
    }
  }, [api, addToast]);

  // --- Wallet attestation ---
  const attestItem = useCallback(async (sigId: string) => {
    setWalletModalTarget(sigId);
    setWalletModalOpen(true);
  }, []);

  const handleWalletSignComplete = useCallback(async (result: {
    walletType: string; walletAddress: string; signature: string; message: string; paymentTxid?: string;
  }) => {
    setWalletModalOpen(false);
    if (!walletModalTarget) return;

    try {
      const res = await api.post(`/api/bitsign/signatures/${walletModalTarget}/attest`, {
        walletSignature: result.signature,
        walletAddress: result.walletAddress,
        walletType: result.walletType,
        paymentTxid: result.paymentTxid,
      });

      if (!res.ok) throw new Error('Attestation failed');
      addToast('Wallet attestation recorded', 'success');
      if (handle) fetchData(handle);
    } catch (err: any) {
      addToast(err.message || 'Attestation failed', 'error');
    }
    setWalletModalTarget(null);
  }, [walletModalTarget, handle, api, fetchData, addToast]);

  // --- Copy TXID ---
  const copyTxid = useCallback((txid: string) => {
    navigator.clipboard.writeText(txid);
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2000);
  }, []);

  // --- Download ---
  const downloadItem = useCallback(async (sigId: string, fileName: string) => {
    try {
      const res = await api.get(`/api/bitsign/signatures/${sigId}/preview`);
      if (!res.ok) throw new Error('Download failed');
      const data = await res.json();

      const link = document.createElement('a');
      link.href = data.data || data.url;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      addToast(err.message || 'Download failed', 'error');
    }
    setContextMenu(null);
  }, [api, addToast]);

  // --- Register signature ---
  const registerSignature = useCallback(async (sigId: string) => {
    try {
      const res = await api.post('/api/bitsign/register-signature', { signatureId: sigId });
      if (!res.ok) throw new Error('Registration failed');
      addToast('Signature registered as your official signature', 'success');
      fetchRegisteredSig();
    } catch (err: any) {
      addToast(err.message || 'Registration failed', 'error');
    }
    setContextMenu(null);
  }, [api, fetchRegisteredSig, addToast]);

  // --- Loading / Auth gate ---
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!handle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <Lock size={40} style={{ color: 'var(--muted)', marginBottom: 8 }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase', margin: 0 }}>Vault</h2>
        <p className="small" style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          Connect your HandCash wallet to access your encrypted signature vault.
        </p>
        <button onClick={login} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8,
          background: 'linear-gradient(135deg, #c9a84c, #e6c665)',
          border: 'none', color: '#000', fontSize: 12, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.12em', cursor: 'pointer',
        }}>
          <Wallet size={14} />
          Connect HandCash
        </button>
      </div>
    );
  }

  // --- Document Signing Canvas ---
  if (selectedDocId && selectedDocBlob) {
    return (
      <DocumentCanvas
        documentUrl={selectedDocBlob}
        documentId={selectedDocId}
        signerHandle={handle}
        elements={placedElements}
        onElementsChange={setPlacedElements}
        onSeal={handleSeal}
        onClose={() => { setSelectedDocId(null); setSelectedDocBlob(null); setPlacedElements([]); }}
      />
    );
  }

  // --- Main Vault UI ---
  return (
    <div className="main" style={{ gridTemplateColumns: '260px 1fr 320px' }}>
      {/* Left panel — Identity + Quick Actions */}
      <div className="panel" style={{ overflow: 'auto' }}>
        <h2>Vault</h2>

        {/* Identity card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(201, 168, 76, 0.04)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
        }}>
          {identity?.avatar_url ? (
            <img src={identity.avatar_url} alt="" style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid rgba(201, 168, 76, 0.2)',
            }} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.15), rgba(201, 168, 76, 0.05))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(201, 168, 76, 0.2)',
              fontSize: 14, fontWeight: 800, color: 'var(--accent)',
            }}>
              {handle.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ${handle}
            </div>
            {identity && (
              <StrengthBadge strength={identity.identity_strength} />
            )}
          </div>
          {identity?.token_id && (
            <a
              href={`https://whatsonchain.com/tx/${identity.token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--muted)', padding: 2 }}
              title="View identity on-chain"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Quick Actions */}
        <h3>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button className="ghost" onClick={() => setSignatureModalOpen(true)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 6px', borderRadius: 8,
            border: '1px solid rgba(201, 168, 76, 0.08)', background: 'var(--panel-2)',
          }}>
            <PenTool size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sign</span>
          </button>
          <button className="ghost" onClick={() => setCaptureMode('PHOTO')} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 6px', borderRadius: 8,
            border: '1px solid rgba(201, 168, 76, 0.08)', background: 'var(--panel-2)',
          }}>
            <Camera size={16} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Photo</span>
          </button>
          <button className="ghost" onClick={() => setCaptureMode('VIDEO')} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 6px', borderRadius: 8,
            border: '1px solid rgba(201, 168, 76, 0.08)', background: 'var(--panel-2)',
          }}>
            <Video size={16} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Video</span>
          </button>
          <button className="ghost" onClick={() => fileInputRef.current?.click()} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 6px', borderRadius: 8,
            border: '1px solid rgba(201, 168, 76, 0.08)', background: 'var(--panel-2)',
          }}>
            <Upload size={16} style={{ color: '#4ade80' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upload</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Counts */}
        <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 'auto' }}>
          {signatures.length} item{signatures.length !== 1 ? 's' : ''} in vault
          {trashItems.length > 0 && ` \u00B7 ${trashItems.length} in trash`}
        </div>
      </div>

      {/* Center panel — Vault Items */}
      <div className="panel" style={{ overflow: 'auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {VAULT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setVaultTab(tab.key)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
                background: vaultTab === tab.key
                  ? 'linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(201, 168, 76, 0.08))'
                  : 'transparent',
                color: vaultTab === tab.key ? 'var(--accent-2)' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              {tab.key === 'trash' && trashItems.length > 0 && (
                <span style={{ marginLeft: 4, color: '#ef4444' }}>({trashItems.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* IP Vault (Bit Trust) */}
        {vaultTab === 'ip-vault' && (
          <BitTrustPanel
            identity={identity}
            handle={handle}
            api={api}
          />
        )}

        {/* Item List */}
        {vaultTab !== 'ip-vault' && (
          <>
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {vaultTab === 'trash' ? (
                  <>
                    <Trash2 size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
                    <div className="small" style={{ color: 'var(--muted)' }}>Trash is empty</div>
                  </>
                ) : (
                  <>
                    <Lock size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
                    <div className="small" style={{ color: 'var(--muted)', marginBottom: 2 }}>No items found</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {vaultTab === 'all'
                        ? 'Draw a signature or upload a document to get started.'
                        : `No ${vaultTab} in your vault yet.`}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredItems.map(sig => {
                  const Icon = getItemIcon(sig.signature_type);
                  const isExpanded = expandedSig === sig.id;
                  const isTrash = vaultTab === 'trash';
                  const isSealed = sig.signature_type === 'SEALED_DOCUMENT';
                  const isDoc = ['DOCUMENT', 'PDF'].includes(sig.signature_type);

                  return (
                    <div key={sig.id} style={{
                      borderRadius: 'var(--radius-sm)',
                      border: isSealed
                        ? '1px solid rgba(201, 168, 76, 0.12)'
                        : '1px solid rgba(255, 255, 255, 0.04)',
                      background: isExpanded ? 'var(--panel-2)' : 'rgba(255, 255, 255, 0.01)',
                      overflow: 'hidden',
                    }}>
                      {/* Item row */}
                      <div
                        onClick={() => previewItem(sig.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isSealed ? 'rgba(201, 168, 76, 0.08)' : 'var(--panel-3)',
                          flexShrink: 0,
                        }}>
                          <Icon size={14} style={{
                            color: isSealed ? 'var(--accent)' : isDoc ? '#60a5fa' : 'var(--muted)',
                          }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {resolveDocName(sig)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
                            <span>{formatDate(sig.created_at)}</span>
                            {sig.txid && !sig.txid.startsWith('pending-') && (
                              <span style={{ color: '#22c55e' }}>On-chain</span>
                            )}
                            {sig.wallet_signed && (
                              <span style={{ color: '#60a5fa' }}>Attested</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
                          {isTrash ? (
                            <button className="ghost" onClick={() => restoreItem(sig.id)} title="Restore" style={{ padding: 4 }}>
                              <RotateCcw size={12} style={{ color: '#22c55e' }} />
                            </button>
                          ) : (
                            <>
                              {isDoc && (
                                <button className="ghost" onClick={() => openDocInCanvas(sig.id)} title="Sign this document" style={{ padding: 4 }}>
                                  <PenTool size={12} style={{ color: 'var(--accent)' }} />
                                </button>
                              )}
                              <button
                                className="ghost"
                                onClick={() => setContextMenu(contextMenu === sig.id ? null : sig.id)}
                                style={{ padding: 4 }}
                              >
                                <MoreVertical size={12} style={{ color: 'var(--muted)' }} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Context menu */}
                      {contextMenu === sig.id && (
                        <div style={{
                          borderTop: '1px solid rgba(201, 168, 76, 0.06)',
                          padding: '6px 8px',
                          display: 'flex', flexWrap: 'wrap', gap: 4,
                          background: 'var(--panel-3)',
                        }}>
                          <button className="ghost" onClick={() => downloadItem(sig.id, resolveDocName(sig))}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: 'var(--muted)' }}>
                            <Download size={10} /> Download
                          </button>
                          {sig.txid && !sig.txid.startsWith('pending-') && (
                            <button className="ghost" onClick={() => copyTxid(sig.txid!)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: copiedTxid === sig.txid ? '#22c55e' : 'var(--muted)' }}>
                              {copiedTxid === sig.txid ? <Check size={10} /> : <Copy size={10} />} TXID
                            </button>
                          )}
                          {sig.txid && !sig.txid.startsWith('pending-') && (
                            <a href={`https://whatsonchain.com/tx/${sig.txid}`} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: 'var(--muted)', textDecoration: 'none' }}>
                              <ExternalLink size={10} /> Explorer
                            </a>
                          )}
                          {!sig.wallet_signed && (
                            <button className="ghost" onClick={() => attestItem(sig.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: 'var(--muted)' }}>
                              <Shield size={10} /> Attest
                            </button>
                          )}
                          {['TLDRAW', 'TYPED'].includes(sig.signature_type) && (
                            <button className="ghost" onClick={() => registerSignature(sig.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: 'var(--accent)' }}>
                              <Stamp size={10} /> Register
                            </button>
                          )}
                          <button className="ghost" onClick={() => { setShareModalOpen(sig.id); setContextMenu(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: 'var(--muted)' }}>
                            <Share2 size={10} /> Share
                          </button>
                          <button className="ghost" onClick={() => deleteItem(sig.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px', borderRadius: 4, color: '#ef4444' }}>
                            <Trash2 size={10} /> Delete
                          </button>
                        </div>
                      )}

                      {/* Preview panel */}
                      {isExpanded && (
                        <div style={{
                          borderTop: '1px solid rgba(201, 168, 76, 0.06)',
                          padding: 14, background: 'var(--panel-3)',
                        }}>
                          {previewLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                              <div style={{ width: 20, height: 20, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            </div>
                          ) : previewData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {previewData.startsWith('data:image') || previewData.startsWith('<svg') ? (
                                previewData.startsWith('<svg') ? (
                                  <div style={{
                                    background: 'white', borderRadius: 8, padding: 12,
                                    maxHeight: 200, overflow: 'auto',
                                  }} dangerouslySetInnerHTML={{ __html: previewData }} />
                                ) : (
                                  <img src={previewData} alt="Preview" style={{
                                    maxWidth: '100%', maxHeight: 200, borderRadius: 8, margin: '0 auto', display: 'block',
                                  }} />
                                )
                              ) : previewData.startsWith('data:video') ? (
                                <video src={previewData} controls style={{
                                  maxWidth: '100%', maxHeight: 200, borderRadius: 8, margin: '0 auto', display: 'block',
                                }} />
                              ) : (
                                <div style={{
                                  fontSize: 10, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace",
                                  wordBreak: 'break-all', maxHeight: 80, overflow: 'auto',
                                }}>
                                  {previewData.slice(0, 200)}...
                                </div>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                                <div>
                                  <div style={{ color: 'var(--muted)', marginBottom: 2 }}>Type</div>
                                  <div style={{ color: 'var(--text)' }}>{sig.signature_type}</div>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--muted)', marginBottom: 2 }}>Created</div>
                                  <div style={{ color: 'var(--text)' }}>{formatDate(sig.created_at)}</div>
                                </div>
                                {sig.txid && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ color: 'var(--muted)', marginBottom: 2 }}>TXID</div>
                                    <div style={{
                                      color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace",
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{sig.txid}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="small" style={{ color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                              No preview available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right panel — Details / Registered Sig */}
      <div className="panel" style={{ overflow: 'auto' }}>
        <h2>Details</h2>

        {/* Registered Signature */}
        {registeredSigSvg && (
          <div style={{
            padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(201, 168, 76, 0.08)',
            background: 'rgba(201, 168, 76, 0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Stamp size={12} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Registered Signature
              </span>
            </div>
            <div style={{
              background: 'white', borderRadius: 6, padding: 8,
              maxHeight: 80, overflow: 'hidden',
            }} dangerouslySetInnerHTML={{ __html: registeredSigSvg }} />
          </div>
        )}

        {/* Selected item info */}
        {expandedSig && filteredItems.find(s => s.id === expandedSig) ? (() => {
          const sig = filteredItems.find(s => s.id === expandedSig)!;
          return (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(201, 168, 76, 0.08)',
              background: 'rgba(201, 168, 76, 0.03)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{resolveDocName(sig)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="small" style={{ color: 'var(--muted)' }}>Type</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{sig.signature_type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="small" style={{ color: 'var(--muted)' }}>Created</span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{formatDate(sig.created_at)}</span>
                </div>
                {sig.txid && (
                  <div>
                    <div className="small" style={{ color: 'var(--muted)', marginBottom: 3 }}>TXID</div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                      color: 'var(--accent)', wordBreak: 'break-all', lineHeight: 1.5,
                      cursor: 'pointer',
                    }} onClick={() => copyTxid(sig.txid!)}>
                      {sig.txid}
                    </div>
                  </div>
                )}
                {sig.wallet_signed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={12} style={{ color: '#60a5fa' }} />
                    <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>Wallet Attested</span>
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Lock size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
            <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Select an item from the vault to see its details.
            </div>
          </div>
        )}

        {/* Privacy notice */}
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(201, 168, 76, 0.04)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
          marginTop: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Shield size={12} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Encrypted
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            All vault items are encrypted at rest and accessible only with your wallet credentials.
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="logo-designer-overlay">
          <div style={{
            background: 'var(--panel)', border: '1px solid rgba(201, 168, 76, 0.15)',
            borderRadius: 12, padding: '16px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Processing...</span>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {signatureModalOpen && (
        <SovereignSignature
          onSave={handleSignatureSave}
          onCancel={() => setSignatureModalOpen(false)}
        />
      )}

      {/* Media Capture */}
      {captureMode && (
        <MediaCapture
          mode={captureMode}
          onCapture={handleMediaCapture}
          onCancel={() => setCaptureMode(null)}
        />
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <ShareModal
          documentId={shareModalOpen}
          documentType="vault_item"
          onClose={() => setShareModalOpen(null)}
        />
      )}

      {/* Wallet Signing Modal */}
      <WalletSigningModal
        isOpen={walletModalOpen}
        onClose={() => { setWalletModalOpen(false); setWalletModalTarget(null); }}
        onSignComplete={handleWalletSignComplete}
        message={`Attest vault item ${walletModalTarget || ''} at ${new Date().toISOString()}`}
        title="Wallet Attestation"
      />
    </div>
  );
}

// --- Sub-components ---

function StrengthBadge({ strength }: { strength: number }) {
  const config = strength >= 4
    ? { label: 'Sovereign', color: '#c9a84c', bg: 'rgba(201, 168, 76, 0.08)', border: 'rgba(201, 168, 76, 0.2)' }
    : strength >= 3
    ? { label: 'Strong', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)' }
    : strength >= 2
    ? { label: 'Verified', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.08)', border: 'rgba(96, 165, 250, 0.2)' }
    : { label: 'Basic', color: 'var(--muted)', bg: 'rgba(90, 88, 80, 0.08)', border: 'rgba(90, 88, 80, 0.2)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 6px', fontSize: 9, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      borderRadius: 10, border: `1px solid ${config.border}`,
      background: config.bg, color: config.color,
    }}>
      <Shield size={9} />
      Lv.{strength} {config.label}
    </span>
  );
}
