'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Lock, LogIn, PenTool, Camera, FileUp, Video, Trash2,
  ChevronDown, X, Download, ExternalLink, Shield, Eye,
  MoreVertical, RotateCcw, AlertTriangle, Send, Users,
  FileText, Image as ImageIcon, Stamp, Inbox, ArrowLeft,
  Share2, Copy, Check, Upload
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
  /** Optional PDF-to-image converter (website-only, uses pdfjs-dist) */
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
          // PDF-to-image conversion — website-only, skip on desktop
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <Lock size={48} className="text-zinc-700 mb-6" />
        <h1 className="text-2xl font-black tracking-tight mb-2">Vault</h1>
        <p className="text-zinc-500 text-sm text-center mb-8 max-w-xs">
          Connect your HandCash wallet to access your encrypted signature vault.
        </p>
        <button
          onClick={login}
          className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-sm uppercase tracking-widest transition-all rounded-full"
        >
          <LogIn size={16} />
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
    <div className="min-h-screen pb-4">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {identity?.avatar_url ? (
              <img src={identity.avatar_url} alt="" className="w-10 h-10 rounded-full border border-zinc-700" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">
                {handle.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-black tracking-tight">${handle}</h1>
              {identity && (
                <StrengthBadge strength={identity.identity_strength} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {identity?.token_id && (
              <a
                href={`https://whatsonchain.com/tx/${identity.token_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-zinc-500 hover:text-white transition-colors"
                title="View identity on-chain"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setSignatureModalOpen(true)}
            className="flex flex-col items-center gap-1.5 p-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
          >
            <PenTool size={18} className="text-amber-400" />
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Sign</span>
          </button>
          <button
            onClick={() => setCaptureMode('PHOTO')}
            className="flex flex-col items-center gap-1.5 p-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
          >
            <Camera size={18} className="text-blue-400" />
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Photo</span>
          </button>
          <button
            onClick={() => setCaptureMode('VIDEO')}
            className="flex flex-col items-center gap-1.5 p-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
          >
            <Video size={18} className="text-purple-400" />
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Video</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 p-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
          >
            <Upload size={18} className="text-green-400" />
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Upload</span>
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
      </div>

      {/* Vault Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {VAULT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setVaultTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full whitespace-nowrap transition-colors ${
                vaultTab === tab.key
                  ? 'bg-white text-black'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {tab.label}
              {tab.key === 'trash' && trashItems.length > 0 && (
                <span className="ml-1 text-[10px] text-red-400">({trashItems.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* IP Vault (Bit Trust) */}
      {vaultTab === 'ip-vault' && (
        <div className="px-4">
          <BitTrustPanel />
        </div>
      )}

      {/* Vault Items */}
      {vaultTab !== 'ip-vault' && <div className="px-4">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {vaultTab === 'trash' ? (
              <>
                <Trash2 size={32} className="text-zinc-700 mb-4" />
                <p className="text-zinc-500 text-sm">Trash is empty</p>
              </>
            ) : (
              <>
                <Lock size={32} className="text-zinc-700 mb-4" />
                <p className="text-zinc-500 text-sm mb-1">No items found</p>
                <p className="text-zinc-600 text-xs">
                  {vaultTab === 'all'
                    ? 'Draw a signature or upload a document to get started.'
                    : `No ${vaultTab} in your vault yet.`}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map(sig => {
              const Icon = getItemIcon(sig.signature_type);
              const isExpanded = expandedSig === sig.id;
              const isTrash = vaultTab === 'trash';
              const isSealed = sig.signature_type === 'SEALED_DOCUMENT';
              const isDoc = ['DOCUMENT', 'PDF'].includes(sig.signature_type);

              return (
                <div key={sig.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                  {/* Item row */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-900/50 transition-colors ${
                      isExpanded ? 'bg-zinc-900/50' : ''
                    }`}
                    onClick={() => previewItem(sig.id)}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isSealed ? 'bg-amber-500/10 text-amber-400' :
                      isDoc ? 'bg-blue-500/10 text-blue-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{resolveDocName(sig)}</p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                        <span>{formatDate(sig.created_at)}</span>
                        {sig.txid && !sig.txid.startsWith('pending-') && (
                          <span className="text-green-600">On-chain</span>
                        )}
                        {sig.wallet_signed && (
                          <span className="text-blue-600">Attested</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {isTrash ? (
                        <button
                          onClick={() => restoreItem(sig.id)}
                          className="p-1.5 text-zinc-500 hover:text-green-400 transition-colors"
                          title="Restore"
                        >
                          <RotateCcw size={14} />
                        </button>
                      ) : (
                        <>
                          {isDoc && (
                            <button
                              onClick={() => openDocInCanvas(sig.id)}
                              className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                              title="Sign this document"
                            >
                              <PenTool size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setContextMenu(contextMenu === sig.id ? null : sig.id)}
                            className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Context menu */}
                  {contextMenu === sig.id && (
                    <div className="border-t border-zinc-800 bg-zinc-950 px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => downloadItem(sig.id, resolveDocName(sig))}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Download size={12} /> Download
                        </button>
                        {sig.txid && !sig.txid.startsWith('pending-') && (
                          <button
                            onClick={() => copyTxid(sig.txid!)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                          >
                            {copiedTxid === sig.txid ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            TXID
                          </button>
                        )}
                        {sig.txid && !sig.txid.startsWith('pending-') && (
                          <a
                            href={`https://whatsonchain.com/tx/${sig.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                          >
                            <ExternalLink size={12} /> Explorer
                          </a>
                        )}
                        {!sig.wallet_signed && (
                          <button
                            onClick={() => attestItem(sig.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Shield size={12} /> Attest
                          </button>
                        )}
                        {['TLDRAW', 'TYPED'].includes(sig.signature_type) && (
                          <button
                            onClick={() => registerSignature(sig.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Stamp size={12} /> Register
                          </button>
                        )}
                        <button
                          onClick={() => { setShareModalOpen(sig.id); setContextMenu(null); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Share2 size={12} /> Share
                        </button>
                        <button
                          onClick={() => deleteItem(sig.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preview panel */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 bg-zinc-950">
                      {previewLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                        </div>
                      ) : previewData ? (
                        <div className="space-y-3">
                          {previewData.startsWith('data:image') || previewData.startsWith('<svg') ? (
                            previewData.startsWith('<svg') ? (
                              <div
                                className="bg-white rounded-lg p-4 max-h-64 overflow-auto"
                                dangerouslySetInnerHTML={{ __html: previewData }}
                              />
                            ) : (
                              <img
                                src={previewData}
                                alt="Preview"
                                className="max-w-full max-h-64 rounded-lg mx-auto"
                              />
                            )
                          ) : previewData.startsWith('data:video') ? (
                            <video
                              src={previewData}
                              controls
                              className="max-w-full max-h-64 rounded-lg mx-auto"
                            />
                          ) : (
                            <div className="text-xs text-zinc-500 font-mono break-all max-h-32 overflow-auto">
                              {previewData.slice(0, 200)}...
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-zinc-600">Type</span>
                              <p className="text-zinc-400">{sig.signature_type}</p>
                            </div>
                            <div>
                              <span className="text-zinc-600">Created</span>
                              <p className="text-zinc-400">{formatDate(sig.created_at)}</p>
                            </div>
                            {sig.txid && (
                              <div className="col-span-2">
                                <span className="text-zinc-600">TXID</span>
                                <p className="text-zinc-400 font-mono truncate">{sig.txid}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-xs text-center py-4">No preview available</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Processing...</span>
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
    ? { label: 'Sovereign', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
    : strength >= 3
    ? { label: 'Strong', color: 'text-green-400 bg-green-500/10 border-green-500/30' }
    : strength >= 2
    ? { label: 'Verified', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
    : { label: 'Basic', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${config.color}`}>
      <Shield size={10} />
      Lv.{strength} {config.label}
    </span>
  );
}
