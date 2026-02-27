'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasPreview from '@shared/components/CanvasPreview';
import LogoDesigner from '@shared/components/LogoDesigner';
import MintCanvas from '@shared/components/MintCanvas';
import MintPanel from '@shared/components/MintPanel';
import ModeToggle from '@shared/components/ModeToggle';
import PageStrip from '@shared/components/PageStrip';
import SplashScreen from '@shared/components/SplashScreen';
import TokenisePanel from '@shared/components/TokenisePanel';
import WalletSelector from '@shared/components/WalletSelector';
import WalletView from '@shared/components/WalletView';
import { createDefaultSettings } from '@shared/lib/defaults';
import { loadImage } from '@shared/lib/image-utils';
import { createTextLogo, initialLogos, type GeneratedLogoStyle } from '@shared/lib/logos';
import type { ActiveIssue, AppMode, AudioSegment, ExtractedFrame, ImageItem, ImageSettings, LogoAsset, Spread, StampReceipt, WalletState, WalletProviderType } from '@shared/lib/types';
import { useMintDesigner } from '@shared/hooks/useMintDesigner';
import { usePlatform } from '@shared/lib/platform-context';
import type { FileHandle } from '@shared/lib/platform';
import {
  type VaultEntry,
  saveToVault,
  listVaultEntries,
  deleteVaultEntry,
  updateVaultEntry,
  encryptForVault,
  decryptFromVault,
  hexFromBytes,
  bytesFromHex,
} from '@shared/lib/mint-vault';
import { estimateUploadCost, uploadToUHRP, downloadFromUHRP } from '@shared/lib/uhrp-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp',
  '.mp4', '.mov', '.webm', '.avi',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',
  '.pdf', '.doc', '.docx', '.txt', '.rtf', '.md', '.csv', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.go', '.rs', '.c', '.cpp',
  '.exe', '.dmg', '.app', '.apk', '.ipa', '.wasm', '.bin', '.iso',
]);

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.avi']);
const DOCUMENT_EXT = new Set(['.pdf', '.doc', '.docx', '.txt', '.rtf', '.md', '.csv', '.xls', '.xlsx', '.ppt', '.pptx']);
const MEDIA_EXT = new Set([...IMAGE_EXT, ...VIDEO_EXT, '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']);

function extOf(name: string): string {
  return '.' + (name.split('.').pop()?.toLowerCase() ?? '');
}

// ---------------------------------------------------------------------------
// Spread helpers
// ---------------------------------------------------------------------------

function buildSpreads(images: ImageItem[]): Spread[] {
  const spreads: Spread[] = [];
  let i = 0;
  while (i < images.length) {
    const img = images[i];
    const isLandscape = img.width > img.height;
    if (isLandscape) {
      spreads.push({ type: 'landscape', image: img });
      i++;
    } else {
      const next = images[i + 1];
      if (next && next.height >= next.width) {
        spreads.push({ type: 'portrait-pair', left: img, right: next });
        i += 2;
      } else {
        spreads.push({ type: 'portrait-solo', image: img });
        i++;
      }
    }
  }
  return spreads;
}

function spreadImages(spread: Spread): ImageItem[] {
  if (spread.type === 'portrait-pair') return [spread.left, spread.right];
  return [spread.image];
}

// ---------------------------------------------------------------------------
// Default stubs for desktop-only hooks
// ---------------------------------------------------------------------------

const defaultTokenisation = {
  mode: 'currency' as AppMode,
  setMode: (() => {}) as (mode: AppMode) => void,
  extractedFrames: new Map<string, ExtractedFrame[]>(),
  audioSegments: new Map<string, AudioSegment[]>(),
  selectedPieceIds: new Set<string>(),
  extractionProgress: null as { percent: number; current: number; total: number } | null,
  mintingProgress: null as { percent: number; current: number; total: number } | null,
  extractFrames: async (_id: string, _path: string, _opts: { interval: number; maxFrames: number; quality: 'low' | 'medium' | 'high' }) => {},
  clearFrames: async (_id: string) => {},
  addAudioSegments: (_id: string, _segments: AudioSegment[]) => {},
  selectPiece: (_id: string, _multi?: boolean) => {},
  selectPieceRange: (_ids: string[]) => {},
  selectEveryNth: (_parentId: string, _n: number) => {},
  selectAllPieces: (_parentId: string) => {},
};

const defaultWalletManager = {
  walletState: {
    connected: false,
    handle: null,
    authToken: null,
    balance: null,
    provider: 'local' as const,
    availableProviders: [] as Array<{ type: WalletProviderType; available: boolean; label: string }>,
    masterAddress: null,
  } as WalletState,
  connect: async () => {},
  disconnect: async () => {},
  switchProvider: async (_type: string) => {},
  refresh: async () => {},
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type DesktopComponents = {
  FlipBookView?: React.ComponentType<any>;
  FrameBrowser?: React.ComponentType<any>;
  WaveformEditor?: React.ComponentType<any>;
  MusicCanvas?: React.ComponentType<any>;
  MusicPanel?: React.ComponentType<any>;
  DocumentHashPanel?: React.ComponentType<any>;
};

type MintAppProps = {
  showDownloadButton?: boolean;
  desktopComponents?: DesktopComponents;
  useTokenisationHook?: () => any;
  useWalletManagerHook?: () => any;
  useMusicEditorHook?: () => any;
};

// ---------------------------------------------------------------------------
// MintApp — shared app shell
// ---------------------------------------------------------------------------

export default function MintApp({
  showDownloadButton,
  desktopComponents,
  useTokenisationHook,
  useWalletManagerHook,
  useMusicEditorHook,
}: MintAppProps) {
  const platform = usePlatform();

  // -----------------------------------------------------------------------
  // Core state
  // -----------------------------------------------------------------------

  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logos, setLogos] = useState<LogoAsset[]>(initialLogos);
  const [isExporting, setIsExporting] = useState(false);
  const [logoForm, setLogoForm] = useState({
    text: '',
    color: '#ffffff',
    style: 'solid' as GeneratedLogoStyle
  });

  // Issue state (in-memory, each issue = a real folder on disk)
  const [issues, setIssues] = useState<ActiveIssue[]>([]);
  const [currentIssueId, setCurrentIssueId] = useState<string | null>(null);

  // Page navigation state
  const [activeSpreadIndex, setActiveSpreadIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [turnDirection, setTurnDirection] = useState<'left' | 'right' | null>(null);
  const [showLogoDesigner, setShowLogoDesigner] = useState(false);
  const [turnMode, setTurnMode] = useState<'slide' | 'turn'>('slide');
  const [comfyConnected, setComfyConnected] = useState(false);
  const [comfyModels, setComfyModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animateResult, setAnimateResult] = useState<string | null>(null);
  const [animateProgress, setAnimateProgress] = useState<{ stage: string; percent: number; elapsed: number; detail?: string } | null>(null);
  const [playingVideo, setPlayingVideo] = useState(false);

  // Stamp state
  const [stampPath, setStampPath] = useState('');
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, handle: null, authToken: null, balance: null, provider: 'local', availableProviders: [], masterAddress: null });
  const [lastReceipt, setLastReceipt] = useState<StampReceipt | null>(null);
  const [isStamping, setIsStamping] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [showDocumentHash, setShowDocumentHash] = useState(false);
  const [showWalletView, setShowWalletView] = useState(false);
  const [allReceipts, setAllReceipts] = useState<StampReceipt[]>([]);

  // Tokenisation state (conditional hook or default stub)
  const [fallbackMode, setFallbackMode] = useState<AppMode>('currency');
  const rawTokenisation = useTokenisationHook ? useTokenisationHook() : defaultTokenisation;
  const tokenisation = useTokenisationHook
    ? rawTokenisation
    : { ...rawTokenisation, mode: fallbackMode, setMode: setFallbackMode };
  const [audioPeaks, setAudioPeaks] = useState<Map<string, number[]>>(new Map());

  // Mint (Currency Designer) state
  const mint = useMintDesigner();
  const [showMintGrid, setShowMintGrid] = useState(false);
  const [mintAnimate, setMintAnimate] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultStatus, setVaultStatus] = useState('');
  const [coverFlowIdx, setCoverFlowIdx] = useState(0);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('mint-splash-seen');
    }
    return true;
  });

  // Music Editor state (conditional hook or undefined)
  const music = useMusicEditorHook ? useMusicEditorHook() : null;

  // Wallet manager (conditional hook or default stub)
  const walletMgr = useWalletManagerHook ? useWalletManagerHook() : defaultWalletManager;

  const canvasPanelRef = useRef<HTMLElement>(null);
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null);

  const currentIssue = useMemo(() => issues.find((i) => i.id === currentIssueId) ?? null, [issues, currentIssueId]);
  const enabledImages = useMemo(() => {
    if (!currentIssue) return images;
    return images.filter((img) => currentIssue.enabledIds.has(img.id));
  }, [images, currentIssue]);
  const spreads = useMemo(() => buildSpreads(images), [images]);

  // Map each image ID to its spread partner (if portrait-pair)
  const pairMap = useMemo(() => {
    const map = new Map<string, string>(); // imageId -> partnerId
    for (const spread of spreads) {
      if (spread.type === 'portrait-pair') {
        map.set(spread.left.id, spread.right.id);
        map.set(spread.right.id, spread.left.id);
      }
    }
    return map;
  }, [spreads]);

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedId) || null,
    [images, selectedId]
  );

  const currentSpreadIndex = useMemo(() => {
    if (!selectedId) return activeSpreadIndex;
    const idx = spreads.findIndex((s) => spreadImages(s).some((img) => img.id === selectedId));
    return idx >= 0 ? idx : activeSpreadIndex;
  }, [spreads, selectedId, activeSpreadIndex]);

  const currentSpread = currentSpreadIndex >= 0 && currentSpreadIndex < spreads.length
    ? spreads[currentSpreadIndex]
    : null;

  const selectedLogo = useMemo(() => {
    if (!selectedImage) return logos[0] || null;
    return logos.find((logo) => logo.id === selectedImage.settings.logoId) || logos[0] || null;
  }, [logos, selectedImage]);

  // Tokenise mode computations
  const currentFrames = useMemo(() => {
    if (!selectedId) return [];
    return tokenisation.extractedFrames.get(selectedId) ?? [];
  }, [selectedId, tokenisation.extractedFrames]);

  const currentSegments = useMemo(() => {
    if (!selectedId) return [];
    return tokenisation.audioSegments.get(selectedId) ?? [];
  }, [selectedId, tokenisation.audioSegments]);

  const currentPeaks = useMemo(() => {
    if (!selectedId) return [];
    return audioPeaks.get(selectedId) ?? [];
  }, [selectedId, audioPeaks]);

  // -----------------------------------------------------------------------
  // Issue management (in-memory, folder-based — desktop only)
  // -----------------------------------------------------------------------

  const handleNewIssue = async () => {
    const parentDir = await platform.chooseExportFolder?.();
    if (!parentDir) return;
    const num = await platform.nextIssueNumber?.(parentDir) ?? 1;
    const name = `mint-${String(num).padStart(3, '0')}`;
    const id = crypto.randomUUID();

    const newIssue: ActiveIssue = { id, name, num, parentDir, enabledIds: new Set() };
    setIssues((prev) => [...prev, newIssue]);
    setCurrentIssueId(id);
  };

  const switchIssue = (id: string) => {
    setCurrentIssueId(id);
  };

  // -----------------------------------------------------------------------
  // Image toggle (add/remove from current issue)
  // -----------------------------------------------------------------------

  const isImageInIssue = useCallback((imageId: string) => {
    if (!currentIssue) return false;
    return currentIssue.enabledIds.has(imageId);
  }, [currentIssue]);

  const toggleImage = (id: string) => {
    if (!currentIssueId) return;
    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.id !== currentIssueId) return issue;
        const next = new Set(issue.enabledIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { ...issue, enabledIds: next };
      })
    );
  };

  // Stop video playback when selection changes
  useEffect(() => {
    setPlayingVideo(false);
  }, [selectedId]);

  // -----------------------------------------------------------------------
  // Image loading
  // -----------------------------------------------------------------------

  const updateSelectedSettings = (patch: Partial<ImageSettings>) => {
    if (!selectedImage) return;
    setImages((prev) =>
      prev.map((image) =>
        image.id === selectedImage.id
          ? { ...image, settings: { ...image.settings, ...patch } }
          : image
      )
    );
  };

  /**
   * Load file handles into the image list. Works with both FileHandle types:
   * - { type: 'path' } — Electron, uses platform.basename / platform.fileUrl / platform.probeMedia
   * - { type: 'file' } — Browser, uses URL.createObjectURL and file.name
   */
  const loadFileHandles = useCallback(async (handles: FileHandle[]) => {
    if (handles.length === 0) return;
    const defaultLogoId = logos[0]?.id ?? 'mint-outline';

    const results = await Promise.all(
      handles.map(async (handle): Promise<ImageItem | null> => {
        try {
          const name = platform.getFileName(handle);
          const ext = extOf(name);

          // --- Audio ---
          if (AUDIO_EXT.has(ext)) {
            // Audio features require ffmpeg (desktop)
            if (!platform.supportedFeatures.has('ffmpeg') || handle.type !== 'path') {
              // Browser: create a basic audio item with placeholder thumbnail
              const audioUrl = handle.type === 'file'
                ? URL.createObjectURL(handle.file)
                : await platform.getFileUrl(handle);
              return {
                id: crypto.randomUUID(),
                path: handle.type === 'path' ? handle.path : '',
                name,
                url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect fill="#222" width="400" height="80"/><text x="200" y="45" fill="#666" text-anchor="middle" font-size="14">Audio</text></svg>'),
                width: 400,
                height: 80,
                mediaType: 'audio' as const,
                settings: createDefaultSettings(defaultLogoId)
              };
            }

            // Desktop path: probe + waveform
            const filePath = handle.path;
            const probe = await platform.probeMedia!(filePath);
            let waveformUrl = '';
            try {
              const tempPath = `${filePath}.waveform.png`;
              await platform.generateWaveform!({ filePath, outputPath: tempPath, width: 400, height: 80 });
              waveformUrl = await platform.fileUrl!(tempPath);
            } catch {
              // Fallback: placeholder
            }

            return {
              id: crypto.randomUUID(),
              path: filePath,
              name,
              url: waveformUrl || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect fill="#222" width="400" height="80"/><text x="200" y="45" fill="#666" text-anchor="middle" font-size="14">Audio</text></svg>'),
              width: 400,
              height: 80,
              mediaType: 'audio' as const,
              duration: probe.duration,
              sampleRate: probe.sampleRate,
              channels: probe.channels,
              settings: createDefaultSettings(defaultLogoId)
            };
          }

          // --- Video ---
          if (VIDEO_EXT.has(ext)) {
            let thumbnailUrl = '';
            let width = 640;
            let height = 360;
            let probe: { duration: number; fps?: number } | undefined;

            if (handle.type === 'path' && platform.supportedFeatures.has('ffmpeg')) {
              // Desktop: use mint-media:// streaming protocol for thumbnail extraction
              const streamUrl = `mint-media://media?path=${encodeURIComponent(handle.path)}`;
              try {
                const thumbData = await loadVideoThumbnailFromUrl(streamUrl);
                width = thumbData.width;
                height = thumbData.height;
                thumbnailUrl = thumbData.thumbnailUrl;
              } catch {
                // Fallback placeholder
                thumbnailUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect fill="#222" width="640" height="360"/><text x="320" y="185" fill="#666" text-anchor="middle" font-size="18">Video</text></svg>');
              }
              try {
                probe = await platform.probeMedia!(handle.path);
              } catch { /* non-critical */ }
            } else if (handle.type === 'file') {
              // Browser: create object URL for thumbnail
              const objectUrl = URL.createObjectURL(handle.file);
              try {
                const thumbData = await loadVideoThumbnailFromUrl(objectUrl);
                width = thumbData.width;
                height = thumbData.height;
                thumbnailUrl = thumbData.thumbnailUrl;
              } catch {
                thumbnailUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect fill="#222" width="640" height="360"/><text x="320" y="185" fill="#666" text-anchor="middle" font-size="18">Video</text></svg>');
              }
            }

            return {
              id: crypto.randomUUID(),
              path: handle.type === 'path' ? handle.path : '',
              name,
              url: thumbnailUrl,
              width,
              height,
              mediaType: 'video' as const,
              duration: probe?.duration,
              frameRate: probe?.fps,
              totalFrames: probe ? Math.floor(probe.duration * (probe.fps ?? 24)) : undefined,
              settings: createDefaultSettings(defaultLogoId)
            };
          }

          // --- Image ---
          if (IMAGE_EXT.has(ext)) {
            const url = await platform.getFileUrl(handle);
            const img = await loadImage(url);
            return {
              id: crypto.randomUUID(),
              path: handle.type === 'path' ? handle.path : '',
              name,
              url,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              mediaType: 'image' as const,
              settings: createDefaultSettings(defaultLogoId)
            };
          }

          // --- Document / Generic file ---
          const fileExt = ext.replace('.', '').toUpperCase() || 'FILE';
          const isDoc = DOCUMENT_EXT.has(ext);
          const icon = isDoc ? '\uD83D\uDCC4' : '\uD83D\uDCE6'; // 📄 or 📦
          const label = isDoc ? `Document: ${name}` : name;
          const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
            <rect fill="#111" width="400" height="300" rx="8"/>
            <text x="200" y="120" fill="#555" text-anchor="middle" font-size="48">${icon}</text>
            <text x="200" y="170" fill="#888" text-anchor="middle" font-size="14" font-family="monospace">${fileExt}</text>
            <text x="200" y="200" fill="#555" text-anchor="middle" font-size="11" font-family="sans-serif">${name.length > 40 ? name.slice(0, 37) + '...' : name}</text>
          </svg>`;
          return {
            id: crypto.randomUUID(),
            path: handle.type === 'path' ? handle.path : '',
            name,
            url: 'data:image/svg+xml,' + encodeURIComponent(svgPlaceholder),
            width: 400,
            height: 300,
            mediaType: 'image' as const,
            settings: createDefaultSettings(defaultLogoId)
          };
        } catch (err) {
          console.error(`Failed to load ${handle.name}:`, err);
          return null;
        }
      })
    );
    const items = results.filter((item): item is ImageItem => item !== null);

    setImages((prev) => [...prev, ...items]);
    setSelectedId((prev) => prev ?? items[0]?.id ?? null);
  }, [logos, platform]);

  const handleSelectFolder = async () => {
    const result = await platform.selectFolder?.();
    if (!result) return;
    // selectFolder returns { folder, files: string[] } — convert paths to FileHandles
    const handles: FileHandle[] = result.files.map((filePath) => ({
      type: 'path' as const,
      path: filePath,
      name: filePath.split(/[\\/]/).pop() || filePath,
    }));
    await loadFileHandles(handles);
  };

  const handleSelectFiles = async () => {
    const handles = await platform.pickFiles({ accept: 'image/*,video/*,audio/*' });
    if (!handles || handles.length === 0) return;
    const filtered = handles.filter((h) => SUPPORTED_EXT.has(extOf(h.name)));
    await loadFileHandles(filtered);
  };

  const handleSelectDocuments = async () => {
    const handles = await platform.pickFiles({ accept: '.pdf,.doc,.docx,.txt,.rtf,.md,.csv,.xls,.xlsx,.ppt,.pptx', multiple: true });
    if (!handles || handles.length === 0) return;
    await loadFileHandles(handles);
  };

  const handleSelectAnyFiles = async () => {
    const handles = await platform.pickFiles({ accept: '*/*', multiple: true });
    if (!handles || handles.length === 0) return;
    await loadFileHandles(handles);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const supported = files; // Accept any file — documents, archives, binaries, media

    // Check if files have a .path property (Electron)
    const firstFile = supported[0] as File & { path?: string };
    if (firstFile?.path) {
      // Electron: use path-based handles
      const handles: FileHandle[] = supported.map((f) => ({
        type: 'path' as const,
        path: (f as File & { path: string }).path,
        name: f.name,
      }));
      await loadFileHandles(handles);
    } else {
      // Browser: use File-based handles
      const handles: FileHandle[] = supported.map((f) => ({
        type: 'file' as const,
        file: f,
        name: f.name,
      }));
      await loadFileHandles(handles);
    }
  }, [loadFileHandles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // -----------------------------------------------------------------------
  // Page navigation with turn animation
  // -----------------------------------------------------------------------

  const triggerTurn = (direction: 'left' | 'right') => {
    setTurnDirection(direction);
    setTimeout(() => setTurnDirection(null), 300);
  };

  const handlePrevSpread = useCallback(() => {
    if (currentSpreadIndex <= 0) return;
    triggerTurn('right');
    const prev = spreads[currentSpreadIndex - 1];
    const imgs = spreadImages(prev);
    setSelectedId(imgs[0].id);
    setActiveSpreadIndex(currentSpreadIndex - 1);
  }, [currentSpreadIndex, spreads]);

  const handleNextSpread = useCallback(() => {
    if (currentSpreadIndex >= spreads.length - 1) return;
    triggerTurn('left');
    const next = spreads[currentSpreadIndex + 1];
    const imgs = spreadImages(next);
    setSelectedId(imgs[0].id);
    setActiveSpreadIndex(currentSpreadIndex + 1);
  }, [currentSpreadIndex, spreads]);

  const handlePageClick = (index: number) => {
    if (index === currentSpreadIndex) return;
    triggerTurn(index > currentSpreadIndex ? 'left' : 'right');
    const spread = spreads[index];
    if (spread) {
      const imgs = spreadImages(spread);
      setSelectedId(imgs[0].id);
      setActiveSpreadIndex(index);
    }
  };

  // Keyboard navigation + Mint mode shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;

      const isCurrency = tokenisation.mode === 'currency';
      const ctrl = e.ctrlKey || e.metaKey;

      // Currency mode shortcuts
      if (isCurrency) {
        if (ctrl && e.key === 'z') { e.preventDefault(); mint.undo(); return; }
        if (ctrl && e.key === 'y') { e.preventDefault(); mint.redo(); return; }
        if (ctrl && e.key === 'd') { e.preventDefault(); if (mint.selectedLayerId) mint.duplicateLayer(mint.selectedLayerId); return; }
        if (ctrl && e.key === 's') { e.preventDefault(); /* save handled by panel */ return; }
        if (ctrl && e.key === 'e') { e.preventDefault(); /* export handled by panel */ return; }
        if ((e.key === 'Delete' || e.key === 'Backspace') && mint.selectedLayerId) {
          e.preventDefault(); mint.removeLayer(mint.selectedLayerId); return;
        }
        // Bracket keys: reorder layer
        if (e.key === '[' && mint.selectedLayerId) {
          e.preventDefault();
          const idx = mint.doc.layers.findIndex((l: any) => l.id === mint.selectedLayerId);
          if (idx > 0) mint.reorderLayer(mint.selectedLayerId, idx - 1);
          return;
        }
        if (e.key === ']' && mint.selectedLayerId) {
          e.preventDefault();
          const idx = mint.doc.layers.findIndex((l: any) => l.id === mint.selectedLayerId);
          if (idx < mint.doc.layers.length - 1) mint.reorderLayer(mint.selectedLayerId, idx + 1);
          return;
        }
        // Arrow keys: nudge transform
        if (e.key === 'ArrowLeft' && mint.selectedLayerId) {
          e.preventDefault();
          mint.updateLayerTransform(mint.selectedLayerId, { x: (mint.selectedLayer?.transform?.x ?? 0) - (e.shiftKey ? 10 : 1) });
          return;
        }
        if (e.key === 'ArrowRight' && mint.selectedLayerId) {
          e.preventDefault();
          mint.updateLayerTransform(mint.selectedLayerId, { x: (mint.selectedLayer?.transform?.x ?? 0) + (e.shiftKey ? 10 : 1) });
          return;
        }
        if (e.key === 'ArrowUp' && mint.selectedLayerId) {
          e.preventDefault();
          mint.updateLayerTransform(mint.selectedLayerId, { y: (mint.selectedLayer?.transform?.y ?? 0) - (e.shiftKey ? 10 : 1) });
          return;
        }
        if (e.key === 'ArrowDown' && mint.selectedLayerId) {
          e.preventDefault();
          mint.updateLayerTransform(mint.selectedLayerId, { y: (mint.selectedLayer?.transform?.y ?? 0) + (e.shiftKey ? 10 : 1) });
          return;
        }
        return;
      }

      // Stamp/Tokenise mode navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSpread();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSpread();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handlePrevSpread, handleNextSpread, tokenisation.mode, mint]);

  // Swipe navigation
  useEffect(() => {
    const el = canvasPanelRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!swipeRef.current || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
      const dy = e.changedTouches[0].clientY - swipeRef.current.startY;
      swipeRef.current = null;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) handleNextSpread();
      else handlePrevSpread();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [handlePrevSpread, handleNextSpread]);

  // -----------------------------------------------------------------------
  // Fullscreen
  // -----------------------------------------------------------------------

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await canvasPanelRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // -----------------------------------------------------------------------
  // ComfyUI (desktop only)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!platform.supportedFeatures.has('comfyui')) return;
    const check = async () => {
      try {
        const connected = await platform.comfyCheck!();
        setComfyConnected(connected);
        if (connected) {
          const models = await platform.comfyListModels!();
          setComfyModels(models);
          setSelectedModel((prev) => prev && models.includes(prev) ? prev : models[0] ?? null);
        } else {
          setComfyModels([]);
        }
      } catch {
        setComfyConnected(false);
        setComfyModels([]);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [platform]);

  // Listen for ComfyUI progress events (desktop only)
  useEffect(() => {
    if (!platform.supportedFeatures.has('comfyui') || !platform.onComfyProgress) return;
    const cleanup = platform.onComfyProgress((data) => {
      setAnimateProgress(data);
    });
    return cleanup;
  }, [platform]);

  // Poll wallet status
  useEffect(() => {
    const check = async () => {
      try {
        const state = await platform.walletStatus();
        setWalletState(state);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [platform]);

  // -----------------------------------------------------------------------
  // Stamp handlers
  // -----------------------------------------------------------------------

  const handleHashAndInscribe = async () => {
    if (!selectedImage || isStamping) return;
    setIsStamping(true);
    try {
      const handle: FileHandle = selectedImage.path
        ? { type: 'path', path: selectedImage.path, name: selectedImage.name }
        : { type: 'file', file: new File([], selectedImage.name), name: selectedImage.name };
      const { hash, size } = await platform.hashFile(handle);
      const timestamp = new Date().toISOString();

      const receipt: StampReceipt = {
        id: crypto.randomUUID(),
        path: stampPath,
        hash,
        algorithm: 'sha256',
        sourceFile: selectedImage.name,
        sourceSize: size,
        timestamp,
        txid: null,
        tokenId: null,
        metadata: {}
      };

      await platform.saveStampReceipt(JSON.stringify(receipt));
      setLastReceipt(receipt);

      // Inscribe if wallet has a key
      try {
        const hasKey = platform.keystoreHasKey ? await platform.keystoreHasKey() : false;
        if (hasKey) {
          const { txid } = await platform.inscribeStamp({ path: stampPath, hash, timestamp });
          await platform.updateStampReceipt(receipt.id, { txid });
          setLastReceipt({ ...receipt, txid });
        }
      } catch (err) {
        console.error('Inscription failed (receipt saved locally):', err);
      }
    } catch (err) {
      console.error('Stamp failed:', err);
      alert(`Stamp failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsStamping(false);
    }
  };

  const handleMintToken = async () => {
    if (!lastReceipt || isMinting || !platform.mintStampToken) return;
    setIsMinting(true);
    try {
      const { tokenId } = await platform.mintStampToken({
        path: lastReceipt.path,
        hash: lastReceipt.hash,
        name: stampPath.split('/').pop() || 'STAMP'
      });
      await platform.updateStampReceipt(lastReceipt.id, { tokenId });
      setLastReceipt({ ...lastReceipt, tokenId });
    } catch (err) {
      console.error('Mint failed:', err);
      alert(`Mint failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleBatchStamp = async () => {
    if (enabledImages.length === 0 || isStamping || !platform.hashFilesBatch) return;
    setIsStamping(true);
    try {
      const paths = enabledImages.map((img) => img.path);
      const results = await platform.hashFilesBatch(paths);

      for (let i = 0; i < results.length; i++) {
        const { hash, size } = results[i];
        const img = enabledImages[i];
        const timestamp = new Date().toISOString();
        const pageNum = String(i + 1).padStart(3, '0');
        const pagePath = `${stampPath}/PAGE-${pageNum}`;

        const receipt: StampReceipt = {
          id: crypto.randomUUID(),
          path: pagePath,
          hash,
          algorithm: 'sha256',
          sourceFile: img.name,
          sourceSize: size,
          timestamp,
          txid: null,
          tokenId: null,
          metadata: {}
        };

        await platform.saveStampReceipt(JSON.stringify(receipt));

        try {
          const hasKey = platform.keystoreHasKey ? await platform.keystoreHasKey() : false;
          if (hasKey) {
            const { txid } = await platform.inscribeStamp({ path: pagePath, hash, timestamp });
            await platform.updateStampReceipt(receipt.id, { txid });
          }
        } catch { /* continue with next */ }
      }

      setLastReceipt({ id: '', path: stampPath, hash: `${results.length} images`, algorithm: 'sha256', sourceFile: 'batch', sourceSize: 0, timestamp: new Date().toISOString(), txid: null, tokenId: null, metadata: {} });
    } catch (err) {
      console.error('Batch stamp failed:', err);
      alert(`Batch stamp failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsStamping(false);
    }
  };

  // -----------------------------------------------------------------------
  // Tokenise handlers
  // -----------------------------------------------------------------------

  const handleExtractFrames = async (interval: number, maxFrames: number, quality: 'low' | 'medium' | 'high') => {
    if (!selectedImage || selectedImage.mediaType !== 'video') return;
    await tokenisation.extractFrames(selectedImage.id, selectedImage.path, { interval, maxFrames, quality });
  };

  const handleClearFrames = async () => {
    if (!selectedId) return;
    await tokenisation.clearFrames(selectedId);
  };

  const handleAudioSegmentsChange = (segments: AudioSegment[]) => {
    if (!selectedId) return;
    tokenisation.addAudioSegments(selectedId, segments);
  };

  // Load audio peaks when selecting an audio item (desktop only)
  useEffect(() => {
    if (!selectedImage || selectedImage.mediaType !== 'audio') return;
    if (audioPeaks.has(selectedImage.id)) return;
    if (!platform.getAudioPeaks || !selectedImage.path) return;
    platform.getAudioPeaks(selectedImage.path, 2000).then((peaks) => {
      setAudioPeaks((prev) => new Map(prev).set(selectedImage.id, peaks));
    }).catch(console.error);
  }, [selectedImage, audioPeaks, platform]);

  const handleStampPieces = async () => {
    if (!selectedImage || isStamping) return;
    setIsStamping(true);
    try {
      const isVideo = selectedImage.mediaType === 'video';
      const isAudio = selectedImage.mediaType === 'audio';

      if (isVideo && currentFrames.length > 0 && platform.hashFilesBatch) {
        const frames = tokenisation.selectedPieceIds.size > 0
          ? currentFrames.filter((f: ExtractedFrame) => tokenisation.selectedPieceIds.has(f.id))
          : currentFrames;
        const paths = frames.map((f: ExtractedFrame) => f.path);
        const results = await platform.hashFilesBatch(paths);
        const sourceHandle: FileHandle = { type: 'path', path: selectedImage.path, name: selectedImage.name };
        const sourceHash = (await platform.hashFile(sourceHandle)).hash;

        for (let i = 0; i < results.length; i++) {
          const { hash, size } = results[i];
          const frame = frames[i];
          const timestamp = new Date().toISOString();
          const padded = String(frame.frameIndex).padStart(3, '0');
          const piecePath = `${stampPath}/FRAME-${padded}`;

          const receipt: StampReceipt = {
            id: crypto.randomUUID(),
            path: piecePath,
            hash,
            algorithm: 'sha256',
            sourceFile: selectedImage.name,
            sourceSize: size,
            timestamp,
            txid: null,
            tokenId: null,
            metadata: { parentHash: sourceHash, pieceIndex: String(frame.frameIndex), totalPieces: String(currentFrames.length) }
          };
          await platform.saveStampReceipt(JSON.stringify(receipt));

          try {
            const hasKey = platform.keystoreHasKey ? await platform.keystoreHasKey() : false;
            if (hasKey) {
              const { txid } = await platform.inscribeStamp({
                path: piecePath, hash, timestamp,
                parentHash: sourceHash, pieceIndex: frame.frameIndex, totalPieces: currentFrames.length
              });
              await platform.updateStampReceipt(receipt.id, { txid });
            }
          } catch { /* continue */ }
        }
        setLastReceipt({ id: '', path: stampPath, hash: `${frames.length} frames`, algorithm: 'sha256', sourceFile: selectedImage.name, sourceSize: 0, timestamp: new Date().toISOString(), txid: null, tokenId: null, metadata: {} });
      } else if (isAudio && currentSegments.length > 0 && platform.extractAudioSegment) {
        // Extract and hash audio segments
        const sourceHandle: FileHandle = { type: 'path', path: selectedImage.path, name: selectedImage.name };
        const sourceHash = (await platform.hashFile(sourceHandle)).hash;
        for (let i = 0; i < currentSegments.length; i++) {
          const seg = currentSegments[i];
          const timestamp = new Date().toISOString();
          const padded = String(seg.segmentIndex).padStart(3, '0');
          const piecePath = `${stampPath}/SEGMENT-${padded}`;

          // Extract segment to temp file, then hash
          const tempPath = `${selectedImage.path}.seg-${padded}.wav`;
          await platform.extractAudioSegment({ filePath: selectedImage.path, outputPath: tempPath, startTime: seg.startTime, endTime: seg.endTime });
          const segHandle: FileHandle = { type: 'path', path: tempPath, name: `seg-${padded}.wav` };
          const { hash, size } = await platform.hashFile(segHandle);

          const receipt: StampReceipt = {
            id: crypto.randomUUID(),
            path: piecePath,
            hash,
            algorithm: 'sha256',
            sourceFile: selectedImage.name,
            sourceSize: size,
            timestamp,
            txid: null,
            tokenId: null,
            metadata: { parentHash: sourceHash, pieceIndex: String(seg.segmentIndex), totalPieces: String(currentSegments.length) }
          };
          await platform.saveStampReceipt(JSON.stringify(receipt));

          try {
            const hasKey = platform.keystoreHasKey ? await platform.keystoreHasKey() : false;
            if (hasKey) {
              const { txid } = await platform.inscribeStamp({
                path: piecePath, hash, timestamp,
                parentHash: sourceHash, pieceIndex: seg.segmentIndex, totalPieces: currentSegments.length
              });
              await platform.updateStampReceipt(receipt.id, { txid });
            }
          } catch { /* continue */ }
        }
        setLastReceipt({ id: '', path: stampPath, hash: `${currentSegments.length} segments`, algorithm: 'sha256', sourceFile: selectedImage.name, sourceSize: 0, timestamp: new Date().toISOString(), txid: null, tokenId: null, metadata: {} });
      } else {
        // Single image — same as stamp mode
        await handleHashAndInscribe();
        return;
      }
    } catch (err) {
      console.error('Tokenise stamp failed:', err);
      alert(`Stamp failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsStamping(false);
    }
  };

  const handleMintPieces = async () => {
    if (!selectedImage || isMinting) return;
    setIsMinting(true);
    try {
      const isVideo = selectedImage.mediaType === 'video';

      if (isVideo && currentFrames.length > 0 && platform.batchMintTokens) {
        const frames = tokenisation.selectedPieceIds.size > 0
          ? currentFrames.filter((f: ExtractedFrame) => tokenisation.selectedPieceIds.has(f.id))
          : currentFrames;

        const pieces = frames.map((f: ExtractedFrame) => {
          const padded = String(f.frameIndex).padStart(3, '0');
          // Extract base64 from frame data URL for icon
          const b64Match = f.url.match(/^data:(.+);base64,(.*)$/);
          return {
            path: `${stampPath}/FRAME-${padded}`,
            hash: f.hash || '',
            name: `FRAME-${padded}`,
            iconDataB64: b64Match?.[2],
            iconContentType: b64Match?.[1]
          };
        });

        await platform.batchMintTokens(pieces);
      } else {
        // Single item
        await handleMintToken();
        return;
      }
    } catch (err) {
      console.error('Tokenise mint failed:', err);
      alert(`Mint failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleWalletConnect = async () => {
    if (walletState.connected) {
      await platform.walletDisconnect();
      setWalletState({ connected: false, handle: null, authToken: null, balance: null, provider: 'local', availableProviders: [], masterAddress: null });
    } else {
      const state = await platform.walletConnect();
      setWalletState(state);
    }
  };

  const loadReceipts = async () => {
    const receipts = await platform.listStampReceipts();
    setAllReceipts(receipts);
    setShowReceiptViewer(true);
  };

  const handleAnimate = async () => {
    if (!selectedImage || isAnimating || !platform.supportedFeatures.has('comfyui')) return;
    setIsAnimating(true);
    setAnimateResult(null);
    setAnimateProgress(null);
    try {
      // Output to the issue folder or prompt for one
      let outputDir: string;
      if (currentIssue) {
        outputDir = `${currentIssue.parentDir}/${currentIssue.name}`;
      } else {
        const picked = await platform.chooseExportFolder?.();
        if (!picked) { setIsAnimating(false); return; }
        outputDir = picked;
      }
      const result = await platform.comfyAnimate!(selectedImage.path, outputDir, {
        frames: 25,
        fps: 8,
        motionStrength: 0.5,
        modelName: selectedModel ?? undefined
      });
      setAnimateResult(result.videoPath);
      alert(`Video saved: ${result.videoPath}`);
    } catch (err) {
      console.error('Animation failed:', err);
      alert(`Animation failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsAnimating(false);
      setAnimateProgress(null);
    }
  };

  // -----------------------------------------------------------------------
  // Logo / Export
  // -----------------------------------------------------------------------

  const handleImportLogo = async () => {
    const handle = await platform.pickLogo();
    if (!handle) return;
    const src = await platform.getFileUrl(handle);
    const name = platform.getFileName(handle);

    const newLogo: LogoAsset = {
      id: `import-${crypto.randomUUID()}`,
      name,
      src,
      kind: 'imported'
    };

    setLogos((prev) => [newLogo, ...prev]);
    if (selectedImage) {
      updateSelectedSettings({ logoId: newLogo.id });
    }
  };

  const handleCreateLogo = () => {
    const newLogo = createTextLogo(logoForm.text, logoForm.color, logoForm.style);
    setLogos((prev) => [newLogo, ...prev]);
    if (selectedImage) {
      updateSelectedSettings({ logoId: newLogo.id });
    }
  };

  const handleApplyLogoToAll = () => {
    if (!selectedLogo) return;
    setImages((prev) => prev.map((image) => ({
      ...image,
      settings: {
        ...image.settings,
        logoId: selectedLogo.id
      }
    })));
  };

  const handlePrint = async () => {
    if (!currentIssue || enabledImages.length === 0 || !platform.createIssue) return;
    setIsExporting(true);
    try {
      const cover = enabledImages[0];
      const body = enabledImages.slice(1);
      await platform.createIssue(
        currentIssue.parentDir,
        currentIssue.num,
        cover.path,
        body.map((img) => img.path)
      );
    } finally {
      setIsExporting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Video playback URL helper
  // -----------------------------------------------------------------------

  function getVideoPlaybackUrl(image: ImageItem): string {
    if (image.path && platform.isDesktop) {
      return `mint-media://media?path=${encodeURIComponent(image.path)}`;
    }
    // Browser: if we have a File-based handle in the item, we'd need the original file.
    // For now, fall back to the thumbnail URL (not ideal for playback).
    return image.url;
  }

  // -----------------------------------------------------------------------
  // Vault handlers
  // -----------------------------------------------------------------------

  const refreshVault = useCallback(async () => {
    try {
      const entries = await listVaultEntries();
      setVaultEntries(entries);
    } catch (err) {
      console.error('Failed to load vault:', err);
    }
  }, []);

  useEffect(() => {
    if (showVault) refreshVault();
  }, [showVault, refreshVault]);

  const handleSaveToVault = async () => {
    setVaultLoading(true);
    setVaultStatus('Encrypting...');
    try {
      // Export current design as PNG thumbnail
      const thumbnail = mint.exportPng() || '';
      const docJson = JSON.stringify(mint.doc);
      // Encrypt the document JSON
      const { ciphertext, iv, envelopeKey } = await encryptForVault(docJson);

      const entry: VaultEntry = {
        id: crypto.randomUUID(),
        name: mint.doc.name || 'Untitled Design',
        thumbnail,
        createdAt: new Date().toISOString(),
        status: 'local',
        iv: hexFromBytes(iv),
        wrappedKey: hexFromBytes(envelopeKey),
        docJson,
        fileSize: ciphertext.byteLength,
      };

      await saveToVault(entry);
      await refreshVault();
      setVaultStatus('Saved to vault');
      setTimeout(() => setVaultStatus(''), 2000);
    } catch (err) {
      setVaultStatus(`Failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setVaultLoading(false);
    }
  };

  const handleUploadToChain = async (entryId: string) => {
    setVaultLoading(true);
    setVaultStatus('Preparing upload...');
    try {
      const entry = vaultEntries.find((e) => e.id === entryId);
      if (!entry || !entry.docJson) throw new Error('Entry not found or missing data');

      // Re-encrypt for upload
      const { ciphertext, iv, envelopeKey } = await encryptForVault(entry.docJson);

      // Estimate cost
      setVaultStatus('Estimating cost...');
      const cost = await estimateUploadCost(ciphertext.byteLength);
      setVaultStatus(`Uploading (est. ${cost.satoshis} sats / $${cost.usd})...`);

      // Update status to uploading
      await updateVaultEntry(entryId, { status: 'uploading' });
      await refreshVault();

      // Upload to UHRP
      const result = await uploadToUHRP(
        ciphertext,
        `${entry.name.replace(/[^a-zA-Z0-9]/g, '_')}.enc`,
        'application/octet-stream'
      );

      // Update entry with on-chain info
      await updateVaultEntry(entryId, {
        status: 'on-chain',
        uhrpUrl: result.uhrpUrl,
        publicUrl: result.publicUrl,
        iv: hexFromBytes(iv),
        wrappedKey: hexFromBytes(envelopeKey),
        fileSize: ciphertext.byteLength,
      });
      await refreshVault();
      setVaultStatus(`On-chain: ${result.uhrpUrl.slice(0, 24)}...`);
      setTimeout(() => setVaultStatus(''), 3000);
    } catch (err) {
      // Revert status if upload failed
      await updateVaultEntry(entryId, { status: 'local' }).catch(() => {});
      await refreshVault();
      setVaultStatus(`Upload failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setVaultLoading(false);
    }
  };

  const handleRestoreFromVault = async (entryId: string) => {
    try {
      const entry = vaultEntries.find((e) => e.id === entryId);
      if (!entry) throw new Error('Entry not found');

      let docJson = entry.docJson;

      // If on-chain and no local docJson, download and decrypt
      if (!docJson && entry.uhrpUrl) {
        setVaultLoading(true);
        setVaultStatus('Downloading from chain...');
        const encrypted = await downloadFromUHRP(entry.uhrpUrl);
        const iv = bytesFromHex(entry.iv);
        const key = bytesFromHex(entry.wrappedKey);
        docJson = await decryptFromVault(encrypted, iv, key);
        setVaultLoading(false);
        setVaultStatus('');
      }

      if (!docJson) throw new Error('No design data available');

      const doc = JSON.parse(docJson);
      mint.loadDocument(doc);
      setShowVault(false);
      setVaultStatus('Design restored');
      setTimeout(() => setVaultStatus(''), 2000);
    } catch (err) {
      setVaultStatus(`Restore failed: ${err instanceof Error ? err.message : err}`);
      setVaultLoading(false);
    }
  };

  const handleDeleteVaultEntry = async (entryId: string) => {
    try {
      await deleteVaultEntry(entryId);
      await refreshVault();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const canvasWrapperClass = [
    'canvas-wrapper',
    turnDirection === 'left' && 'turning-left',
    turnDirection === 'right' && 'turning-right'
  ].filter(Boolean).join(' ');

  // Whether FlipBookView is available (desktop only)
  const FlipBookView = desktopComponents?.FlipBookView;
  const FrameBrowser = desktopComponents?.FrameBrowser;
  const WaveformEditor = desktopComponents?.WaveformEditor;
  const MusicCanvas = desktopComponents?.MusicCanvas;
  const MusicPanel = desktopComponents?.MusicPanel;
  const DocumentHashPanel = desktopComponents?.DocumentHashPanel;

  return (
    <div className="app" onDrop={handleDrop} onDragOver={handleDragOver}>
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="brand-title">The Bitcoin Corporation <span className="brand-accent">Mint</span></h1>
          <WalletSelector
            walletState={walletMgr.walletState}
            onSwitchProvider={walletMgr.switchProvider}
            onConnect={walletMgr.connect}
            onDisconnect={walletMgr.disconnect}
            onOpenWalletView={() => setShowWalletView(true)}
          />
          <div className="issue-carousel">
            {issues.map((iss) => (
              <button
                key={iss.id}
                className={`issue-chip ${iss.id === currentIssueId ? 'active' : ''}`}
                onClick={() => switchIssue(iss.id)}
                title={`${iss.parentDir}/${iss.name}`}
              >
                {iss.name}
                {iss.id === currentIssueId && (
                  <span className="issue-chip-count">{iss.enabledIds.size}</span>
                )}
              </button>
            ))}
            <button className="issue-chip new-issue" onClick={handleNewIssue}>
              + New
            </button>
          </div>
        </div>
        <div className="topbar-actions">
          <ModeToggle mode={tokenisation.mode} onChange={tokenisation.setMode} />
          {platform.supportedFeatures.has('folder-access') && (
            <button className="secondary" onClick={handleSelectFolder}>
              Load Folder
            </button>
          )}
          <button className="secondary" onClick={handleSelectFiles}>
            Add Media
          </button>
          <button className="secondary" onClick={handleSelectDocuments}>
            Documents
          </button>
          <button className="secondary" onClick={handleSelectAnyFiles}>
            Files
          </button>
          {showDownloadButton && (
            <a
              href="https://github.com/b0ase/bcorp-mint/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="secondary"
              style={{ textDecoration: 'none' }}
            >
              Download Desktop
            </a>
          )}
          {tokenisation.mode === 'currency' && (
            <button className="secondary" onClick={() => setShowVault(true)}>
              Vault
            </button>
          )}
          <button onClick={handlePrint} disabled={!currentIssue || enabledImages.length === 0 || isExporting}>
            {isExporting ? 'Printing\u2026' : 'Print'}
          </button>
          <button
            className="fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '\u2716' : '\u26F6'}
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="panel left-panel">
          <h2>{tokenisation.mode === 'currency' ? 'Assets' : tokenisation.mode === 'tokenise' ? 'Media' : tokenisation.mode === 'music' ? 'Scores' : 'Images'}</h2>
          <div className="image-list">
            {images.length === 0 ? (
              <div className="empty-sidebar">
                {tokenisation.mode === 'currency' ? (
                  <>
                    <div className="empty-sidebar-icon">{'\u2756'}</div>
                    <div className="small" style={{ color: 'var(--accent-dim)' }}>Currency Designer</div>
                    <div className="small">Import background images, portraits, or textures for your banknote layers.</div>
                    <div className="small" style={{ opacity: 0.4, marginTop: 4 }}>Supports JPG, PNG, WebP, TIFF</div>
                  </>
                ) : tokenisation.mode === 'tokenise' ? (
                  <>
                    <div className="empty-sidebar-icon">{'\u2699'}</div>
                    <div className="small" style={{ color: 'var(--accent-dim)' }}>Tokenise Media</div>
                    <div className="small">Load video, audio, or image files to decompose into tokenisable pieces.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <div className="small" style={{ opacity: 0.4 }}>Video: MP4, MOV, WebM</div>
                      <div className="small" style={{ opacity: 0.4 }}>Audio: MP3, WAV, FLAC, AAC</div>
                      <div className="small" style={{ opacity: 0.4 }}>Image: JPG, PNG, WebP</div>
                    </div>
                  </>
                ) : tokenisation.mode === 'music' ? (
                  <>
                    <div className="empty-sidebar-icon">{'\u266B'}</div>
                    <div className="small" style={{ color: 'var(--accent-dim)' }}>Sheet Music</div>
                    <div className="small">Create notation from scratch using the editor, or import reference images.</div>
                    <div className="small" style={{ opacity: 0.4, marginTop: 4 }}>Desktop app: full notation editor</div>
                  </>
                ) : (
                  <>
                    <div className="empty-sidebar-icon">{'\u25C8'}</div>
                    <div className="small" style={{ color: 'var(--accent-dim)' }}>Stamp &amp; Frame</div>
                    <div className="small">Drop files here or use Add Media above. Each image gets framed, watermarked, and stamped to chain.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <div className="small" style={{ opacity: 0.4 }}>Vignette &middot; Frame &middot; Logo</div>
                      <div className="small" style={{ opacity: 0.4 }}>Watermark &middot; SHA-256 &middot; Inscribe</div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              images.map((image) => {
                const inIssue = isImageInIssue(image.id);
                const partnerId = pairMap.get(image.id);
                const isPaired = !!partnerId;
                const isPartnerSelected = partnerId === selectedId;
                return (
                  <div
                    key={image.id}
                    className={[
                      'image-card',
                      image.id === selectedId && 'active',
                      isPartnerSelected && 'paired',
                      currentIssue && !inIssue && 'is-disabled',
                      isPaired && 'is-paired'
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (currentIssue && !inIssue) {
                        toggleImage(image.id);
                      }
                      setSelectedId(image.id);
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img src={image.url} alt={image.name} />
                      {image.mediaType === 'video' && (
                        <span className="video-badge">VID</span>
                      )}
                      {image.mediaType === 'audio' && (
                        <span className="video-badge" style={{ background: 'rgba(100, 149, 237, 0.85)' }}>AUD</span>
                      )}
                    </div>
                    <div className="image-meta">
                      <strong>{image.name}</strong>
                      <span>
                        {image.mediaType === 'video' ? 'Video' : image.mediaType === 'audio' ? 'Audio' : (image.width > image.height ? 'L' : 'P')}
                        {image.duration ? ` \u00b7 ${Math.floor(image.duration)}s` : ''}
                        {isPaired ? ' \u00b7 Paired' : ''}
                        {currentIssue ? (inIssue ? ' \u00b7 In' : '') : ''}
                      </span>
                    </div>
                    {currentIssue && (
                      <button
                        className="image-toggle"
                        onClick={(e) => { e.stopPropagation(); toggleImage(image.id); }}
                        title={inIssue ? 'Remove from issue' : 'Add to issue'}
                      >
                        {inIssue ? '\u25C9' : '\u25CB'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="canvas-panel" ref={canvasPanelRef}>
          {/* Currency mode: Currency Designer canvas */}
          {tokenisation.mode === 'currency' ? (
            <MintCanvas
              doc={mint.doc}
              selectedLayerId={mint.selectedLayerId}
              renderToCanvas={mint.renderToCanvas}
              onSelectLayer={mint.selectLayer}
              showGrid={showMintGrid}
              animatePreview={mintAnimate}
            />
          ) : /* Music mode: Sheet Music Notation Editor (desktop only) */
          tokenisation.mode === 'music' && MusicCanvas && music ? (
            <MusicCanvas
              score={music.score}
              selectedStaffId={music.selectedStaffId}
              selectedMeasureIdx={music.selectedMeasureIdx}
              selectedNoteIdx={music.selectedNoteIdx}
              currentTool={music.currentTool}
              currentDuration={music.currentDuration}
              dotted={music.dotted}
              onAddNote={music.addNote}
              onSelectNote={music.selectNote}
              onRemoveNote={music.removeNote}
              renderToCanvas={music.renderToCanvas}
            />
          ) : tokenisation.mode === 'music' && !MusicCanvas ? (
            <div className="canvas-empty-state music-empty">
              <div className="demo-container music-demo">
                <div className="score-title">F&#252;r Elise</div>
                <div className="score-composer">L. van Beethoven</div>
                <svg viewBox="0 0 420 160" width="420" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {[0,1,2,3,4].map(i => (
                    <line key={`t${i}`} x1="20" y1={30 + i * 8} x2="400" y2={30 + i * 8} stroke="rgba(212,175,55,0.2)" strokeWidth="0.8" />
                  ))}
                  {[0,1,2,3,4].map(i => (
                    <line key={`b${i}`} x1="20" y1={95 + i * 8} x2="400" y2={95 + i * 8} stroke="rgba(212,175,55,0.2)" strokeWidth="0.8" />
                  ))}
                  <path d="M 22 30 C 14 55 14 70 22 95 C 14 95 14 95 22 127" stroke="rgba(212,175,55,0.4)" strokeWidth="1.2" fill="none" />
                  <g transform="translate(30,33) scale(0.6)" opacity="0.6">
                    <path d="M 8 40 C 8 28 16 20 16 10 C 16 4 12 0 8 0 C 4 0 0 4 0 10 C 0 16 4 18 8 18 C 12 18 16 16 16 10 C 16 20 8 28 8 40 C 8 48 12 54 16 54 C 18 54 20 52 20 48 C 20 44 16 42 14 42" fill="none" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
                  </g>
                  <g transform="translate(30,95) scale(0.55)" opacity="0.6">
                    <path d="M 0 10 C 0 4 4 0 10 0 C 14 0 18 4 18 8 C 18 14 12 18 8 18 L 0 28" fill="none" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="22" cy="6" r="2" fill="#d4af37" />
                    <circle cx="22" cy="14" r="2" fill="#d4af37" />
                  </g>
                  <text x="56" y="48" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">3</text>
                  <text x="56" y="62" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">8</text>
                  <text x="56" y="112" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">3</text>
                  <text x="56" y="126" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">8</text>
                  {[150, 235, 320].map(x => (
                    <g key={x}>
                      <line x1={x} y1={30} x2={x} y2={62} stroke="rgba(212,175,55,0.25)" strokeWidth="0.8" />
                      <line x1={x} y1={95} x2={x} y2={127} stroke="rgba(212,175,55,0.25)" strokeWidth="0.8" />
                    </g>
                  ))}
                  <line x1="398" y1={30} x2="398" y2={62} stroke="rgba(212,175,55,0.3)" strokeWidth="0.8" />
                  <line x1="400" y1={30} x2="400" y2={62} stroke="rgba(212,175,55,0.4)" strokeWidth="2" />
                  <line x1="398" y1={95} x2="398" y2={127} stroke="rgba(212,175,55,0.3)" strokeWidth="0.8" />
                  <line x1="400" y1={95} x2="400" y2={127} stroke="rgba(212,175,55,0.4)" strokeWidth="2" />
                  {[
                    { x: 80, y: 30, stem: 'up' },
                    { x: 95, y: 34, stem: 'up', accidental: true },
                    { x: 110, y: 30, stem: 'up' },
                    { x: 125, y: 34, stem: 'up', accidental: true },
                    { x: 140, y: 30, stem: 'up' },
                    { x: 165, y: 46, stem: 'up' },
                    { x: 183, y: 38, stem: 'up' },
                    { x: 200, y: 42, stem: 'up' },
                    { x: 220, y: 50, stem: 'down' },
                    { x: 250, y: 58, stem: 'down' },
                    { x: 268, y: 50, stem: 'down' },
                    { x: 285, y: 46, stem: 'up' },
                    { x: 335, y: 42, stem: 'up' },
                    { x: 355, y: 30, stem: 'up' },
                    { x: 375, y: 34, stem: 'up' },
                  ].map((n, i) => (
                    <g key={i} opacity="0.55">
                      {(n as any).accidental && (
                        <text x={n.x - 8} y={n.y + 4} fontSize="10" fill="#d4af37" fontFamily="serif">#</text>
                      )}
                      <ellipse cx={n.x} cy={n.y} rx="4.5" ry="3.2" fill="#d4af37" transform={`rotate(-15 ${n.x} ${n.y})`} />
                      {n.stem === 'up' ? (
                        <line x1={n.x + 4} y1={n.y} x2={n.x + 4} y2={n.y - 24} stroke="#d4af37" strokeWidth="0.8" />
                      ) : (
                        <line x1={n.x - 4} y1={n.y} x2={n.x - 4} y2={n.y + 24} stroke="#d4af37" strokeWidth="0.8" />
                      )}
                    </g>
                  ))}
                  {[
                    { x: 220, y: 111 },
                    { x: 250, y: 103 },
                    { x: 268, y: 107 },
                  ].map((n, i) => (
                    <g key={`bass-${i}`} opacity="0.4">
                      <ellipse cx={n.x} cy={n.y} rx="4.5" ry="3.2" fill="#d4af37" transform={`rotate(-15 ${n.x} ${n.y})`} />
                      <line x1={n.x - 4} y1={n.y} x2={n.x - 4} y2={n.y + 24} stroke="#d4af37" strokeWidth="0.8" />
                    </g>
                  ))}
                  <line x1="84" y1="6" x2="144" y2="6" stroke="#d4af37" strokeWidth="1.5" opacity="0.45" />
                </svg>
                <div className="demo-hint">Create, edit, and inscribe sheet music scores. Full editor available in the desktop app.</div>
              </div>
            </div>
          ) : /* Tokenise mode: show FrameBrowser or WaveformEditor (desktop components) */
          tokenisation.mode === 'tokenise' && selectedImage?.mediaType === 'video' && currentFrames.length > 0 && FrameBrowser ? (
            <FrameBrowser
              frames={currentFrames}
              selectedIds={tokenisation.selectedPieceIds}
              onSelectFrame={(id: string, multi: boolean) => tokenisation.selectPiece(id, multi)}
              onSelectRange={(ids: string[]) => tokenisation.selectPieceRange(ids)}
              onSelectEveryNth={(n: number) => selectedId && tokenisation.selectEveryNth(selectedId, n)}
              onSelectAll={() => selectedId && tokenisation.selectAllPieces(selectedId)}
            />
          ) : tokenisation.mode === 'tokenise' && selectedImage?.mediaType === 'audio' && currentPeaks.length > 0 && WaveformEditor ? (
            <WaveformEditor
              filePath={selectedImage.path}
              duration={selectedImage.duration || 0}
              peaks={currentPeaks}
              segments={currentSegments}
              onSegmentsChange={handleAudioSegmentsChange}
              parentId={selectedImage.id}
            />
          ) : images.length === 0 ? (
            <div className={`canvas-empty-state ${
              tokenisation.mode === 'currency' ? 'mint-empty' :
              tokenisation.mode === 'tokenise' ? 'tokenise-empty' :
              tokenisation.mode === 'music' ? 'music-empty' :
              'stamp-empty'
            }`}>
              {/* --- Currency Demo: Gold Banknote Blueprint --- */}
              {tokenisation.mode === 'currency' && (
                <div className="demo-container banknote-demo">
                  <svg viewBox="0 0 400 200" width="400" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Outer border */}
                    <rect x="4" y="4" width="392" height="192" rx="6" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="2 3" />
                    <rect x="10" y="10" width="380" height="180" rx="4" stroke="#d4af37" strokeWidth="0.8" />
                    {/* Guilloche corner arcs */}
                    {[[16,16],[384,16],[16,184],[384,184]].map(([cx,cy], i) => (
                      <g key={i}>
                        <path d={`M ${cx} ${cy + (cy < 100 ? 20 : -20)} A 20 20 0 0 ${cy < 100 ? (cx < 200 ? 1 : 0) : (cx < 200 ? 0 : 1)} ${cx + (cx < 200 ? 20 : -20)} ${cy}`} stroke="#d4af37" strokeWidth="0.6" opacity="0.5" />
                        <path d={`M ${cx} ${cy + (cy < 100 ? 30 : -30)} A 30 30 0 0 ${cy < 100 ? (cx < 200 ? 1 : 0) : (cx < 200 ? 0 : 1)} ${cx + (cx < 200 ? 30 : -30)} ${cy}`} stroke="#d4af37" strokeWidth="0.4" opacity="0.3" />
                      </g>
                    ))}
                    {/* Central portrait oval */}
                    <ellipse cx="200" cy="95" rx="42" ry="52" stroke="#d4af37" strokeWidth="0.8" opacity="0.5" />
                    <ellipse cx="200" cy="95" rx="38" ry="48" stroke="#d4af37" strokeWidth="0.4" opacity="0.3" strokeDasharray="3 2" />
                    {/* Denomination */}
                    <text x="50" y="60" fontFamily="'IBM Plex Mono', monospace" fontSize="28" fontWeight="700" fill="#d4af37" opacity="0.6">100</text>
                    <text x="340" y="60" fontFamily="'IBM Plex Mono', monospace" fontSize="28" fontWeight="700" fill="#d4af37" opacity="0.6" textAnchor="end">100</text>
                    {/* Serial number area */}
                    <rect x="130" y="160" width="140" height="16" rx="2" stroke="#d4af37" strokeWidth="0.5" opacity="0.4" strokeDasharray="4 2" />
                    <text x="200" y="172" fontFamily="'IBM Plex Mono', monospace" fontSize="8" fill="#d4af37" opacity="0.35" textAnchor="middle" letterSpacing="2">AA 000000 000</text>
                    {/* QR code grid (bottom-right) */}
                    <g opacity="0.35">
                      {Array.from({ length: 5 }, (_, r) =>
                        Array.from({ length: 5 }, (_, c) => (
                          <rect key={`${r}-${c}`} x={340 + c * 6} y={148 + r * 6} width="5" height="5" rx="0.5" fill={(r + c) % 3 === 0 ? '#d4af37' : 'none'} stroke="#d4af37" strokeWidth="0.3" />
                        ))
                      )}
                    </g>
                    {/* Horizontal guilloche lines */}
                    {[30, 170].map(y => (
                      <line key={y} x1="80" y1={y} x2="320" y2={y} stroke="#d4af37" strokeWidth="0.3" opacity="0.25" />
                    ))}
                    {/* "THE MINT" header */}
                    <text x="200" y="34" fontFamily="'IBM Plex Mono', monospace" fontSize="9" fill="#d4af37" opacity="0.45" textAnchor="middle" letterSpacing="6">THE MINT</text>
                  </svg>
                  <div className="demo-hint">Design banknotes, certificates, and currency with the 18-layer visual editor.</div>
                </div>
              )}

              {/* --- Stamp Demo: Circular Seals & Rosettes --- */}
              {tokenisation.mode === 'stamp' && (
                <div className="demo-container">
                  <svg viewBox="0 0 360 240" width="360" height="240" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Crosshatch background */}
                    <defs>
                      <pattern id="crosshatch" width="8" height="8" patternUnits="userSpaceOnUse">
                        <path d="M 0 8 L 8 0 M -1 1 L 1 -1 M 7 9 L 9 7" stroke="#d4af37" strokeWidth="0.2" opacity="0.1" />
                      </pattern>
                    </defs>
                    <rect width="360" height="240" fill="url(#crosshatch)" />
                    {/* Seal 1 — large, tilted left */}
                    <g className="seal-group" style={{ '--r': '-12deg', '--delay': '0s' } as React.CSSProperties} transform="translate(100,120)">
                      <circle r="65" stroke="#b8960c" strokeWidth="1.2" opacity="0.5" />
                      <circle r="58" stroke="#b8960c" strokeWidth="0.6" opacity="0.35" />
                      <circle r="52" stroke="#b8960c" strokeWidth="0.4" opacity="0.25" strokeDasharray="2 2" />
                      {/* Rosette — concentric rings */}
                      {[18, 26, 34].map((r, i) => (
                        <circle key={i} r={r} stroke="#b8960c" strokeWidth="0.4" opacity={0.2 - i * 0.04} strokeDasharray={`${2 + i} ${1 + i}`} />
                      ))}
                      {/* Star emblem */}
                      <path d="M 0 -10 L 3 -3 L 10 -3 L 5 2 L 7 10 L 0 6 L -7 10 L -5 2 L -10 -3 L -3 -3 Z" fill="#b8960c" opacity="0.3" />
                      {/* Radial text */}
                      <path id="seal1-arc" d="M -45 0 A 45 45 0 1 1 45 0" fill="none" />
                      <text fontSize="6" fill="#b8960c" opacity="0.4" letterSpacing="3">
                        <textPath href="#seal1-arc" startOffset="10%">CERTIFIED AUTHENTIC</textPath>
                      </text>
                    </g>
                    {/* Seal 2 — medium, tilted right */}
                    <g className="seal-group" style={{ '--r': '8deg', '--delay': '0.4s' } as React.CSSProperties} transform="translate(220,100)">
                      <circle r="50" stroke="#8a8a8a" strokeWidth="1" opacity="0.4" />
                      <circle r="44" stroke="#8a8a8a" strokeWidth="0.5" opacity="0.3" />
                      <circle r="38" stroke="#8a8a8a" strokeWidth="0.3" opacity="0.2" strokeDasharray="1.5 2" />
                      {[14, 20, 27].map((r, i) => (
                        <circle key={i} r={r} stroke="#8a8a8a" strokeWidth="0.3" opacity={0.15 - i * 0.03} strokeDasharray={`${1.5 + i} ${1 + i}`} />
                      ))}
                      <circle r="5" fill="#8a8a8a" opacity="0.2" />
                      <path id="seal2-arc" d="M -35 0 A 35 35 0 1 1 35 0" fill="none" />
                      <text fontSize="5" fill="#8a8a8a" opacity="0.35" letterSpacing="2.5">
                        <textPath href="#seal2-arc" startOffset="15%">OFFICIAL SEAL</textPath>
                      </text>
                    </g>
                    {/* Seal 3 — small accent */}
                    <g className="seal-group" style={{ '--r': '20deg', '--delay': '0.8s' } as React.CSSProperties} transform="translate(290,160)">
                      <circle r="32" stroke="#b8960c" strokeWidth="0.8" opacity="0.35" />
                      <circle r="27" stroke="#b8960c" strokeWidth="0.4" opacity="0.25" />
                      {[10, 16].map((r, i) => (
                        <circle key={i} r={r} stroke="#b8960c" strokeWidth="0.3" opacity={0.15 - i * 0.04} strokeDasharray={`${1 + i} ${1 + i}`} />
                      ))}
                      <path d="M 0 -5 L 2 -1.5 L 5 -1.5 L 3 1 L 4 5 L 0 3 L -4 5 L -3 1 L -5 -1.5 L -2 -1.5 Z" fill="#b8960c" opacity="0.25" />
                    </g>
                  </svg>
                  <div className="demo-hint">Load media to frame, watermark, and inscribe to chain.</div>
                </div>
              )}

              {/* --- Tokenise Demo: Interactive Cover Flow --- */}
              {tokenisation.mode === 'tokenise' && (
                <div className="demo-container">
                  <div
                    className="coverflow-container"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') { e.preventDefault(); setCoverFlowIdx(p => Math.max(p - 1, -3)); }
                      if (e.key === 'ArrowRight') { e.preventDefault(); setCoverFlowIdx(p => Math.min(p + 1, 3)); }
                    }}
                    onWheel={(e) => {
                      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                        setCoverFlowIdx(p => Math.max(-3, Math.min(3, p + (e.deltaX > 0 ? 1 : -1))));
                      } else {
                        setCoverFlowIdx(p => Math.max(-3, Math.min(3, p + (e.deltaY > 0 ? 1 : -1))));
                      }
                    }}
                  >
                    <div className="coverflow-track">
                      {Array.from({ length: 11 }, (_, idx) => idx - 5).map(cardIdx => {
                        const rel = cardIdx - coverFlowIdx;
                        if (Math.abs(rel) > 4) return null;
                        const absRel = Math.abs(rel);
                        const rotateY = rel * -25;
                        const translateX = rel * 60;
                        const translateZ = -absRel * 50;
                        const cardOpacity = Math.max(0, 1 - absRel * 0.22);
                        const frameNum = cardIdx + 6;
                        return (
                          <div
                            key={cardIdx}
                            className={`coverflow-card${rel === 0 ? ' coverflow-active' : ''}`}
                            style={{
                              transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                              opacity: cardOpacity,
                              zIndex: 10 - absRel,
                              cursor: 'pointer',
                              transition: 'transform 0.4s ease, opacity 0.4s ease',
                            }}
                            onClick={() => setCoverFlowIdx(cardIdx)}
                          >
                            <div className="card-perf" />
                            <div className="card-num">#{String(frameNum).padStart(3, '0')}</div>
                            <span style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>FRAME</span>
                            <div className="card-perf-bottom" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="coverflow-nav">
                      <button className="coverflow-arrow" onClick={() => setCoverFlowIdx(p => Math.max(p - 1, -5))} disabled={coverFlowIdx <= -5}>{'\u2039'}</button>
                      <span className="coverflow-label">Frame {coverFlowIdx + 6} of 11</span>
                      <button className="coverflow-arrow" onClick={() => setCoverFlowIdx(p => Math.min(p + 1, 5))} disabled={coverFlowIdx >= 5}>{'\u203A'}</button>
                    </div>
                  </div>
                  <div className="demo-hint">Scroll, arrow keys, or click to browse. Load media to extract real frames.</div>
                </div>
              )}

              {/* --- Music Demo: Für Elise Sheet Music --- */}
              {tokenisation.mode === 'music' && (
                <div className="demo-container music-demo">
                  <div className="score-title">F&#252;r Elise</div>
                  <div className="score-composer">L. van Beethoven</div>
                  <svg viewBox="0 0 420 160" width="420" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Treble staff */}
                    {[0,1,2,3,4].map(i => (
                      <line key={`t${i}`} x1="20" y1={30 + i * 8} x2="400" y2={30 + i * 8} stroke="rgba(212,175,55,0.2)" strokeWidth="0.8" />
                    ))}
                    {/* Bass staff */}
                    {[0,1,2,3,4].map(i => (
                      <line key={`b${i}`} x1="20" y1={95 + i * 8} x2="400" y2={95 + i * 8} stroke="rgba(212,175,55,0.2)" strokeWidth="0.8" />
                    ))}
                    {/* Brace */}
                    <path d="M 22 30 C 14 55 14 70 22 95 C 14 95 14 95 22 127" stroke="rgba(212,175,55,0.4)" strokeWidth="1.2" fill="none" />
                    {/* Treble clef */}
                    <g transform="translate(30,33) scale(0.6)" opacity="0.6">
                      <path d="M 8 40 C 8 28 16 20 16 10 C 16 4 12 0 8 0 C 4 0 0 4 0 10 C 0 16 4 18 8 18 C 12 18 16 16 16 10 C 16 20 8 28 8 40 C 8 48 12 54 16 54 C 18 54 20 52 20 48 C 20 44 16 42 14 42" fill="none" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
                    </g>
                    {/* Bass clef */}
                    <g transform="translate(30,95) scale(0.55)" opacity="0.6">
                      <path d="M 0 10 C 0 4 4 0 10 0 C 14 0 18 4 18 8 C 18 14 12 18 8 18 L 0 28" fill="none" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="22" cy="6" r="2" fill="#d4af37" />
                      <circle cx="22" cy="14" r="2" fill="#d4af37" />
                    </g>
                    {/* Time signature 3/8 */}
                    <text x="56" y="48" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">3</text>
                    <text x="56" y="62" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">8</text>
                    <text x="56" y="112" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">3</text>
                    <text x="56" y="126" fontFamily="serif" fontSize="14" fill="#d4af37" opacity="0.5" fontWeight="bold">8</text>
                    {/* Bar lines */}
                    {[150, 235, 320].map(x => (
                      <g key={x}>
                        <line x1={x} y1={30} x2={x} y2={62} stroke="rgba(212,175,55,0.25)" strokeWidth="0.8" />
                        <line x1={x} y1={95} x2={x} y2={127} stroke="rgba(212,175,55,0.25)" strokeWidth="0.8" />
                      </g>
                    ))}
                    {/* Final double bar */}
                    <line x1="398" y1={30} x2="398" y2={62} stroke="rgba(212,175,55,0.3)" strokeWidth="0.8" />
                    <line x1="400" y1={30} x2="400" y2={62} stroke="rgba(212,175,55,0.4)" strokeWidth="2" />
                    <line x1="398" y1={95} x2="398" y2={127} stroke="rgba(212,175,55,0.3)" strokeWidth="0.8" />
                    <line x1="400" y1={95} x2="400" y2={127} stroke="rgba(212,175,55,0.4)" strokeWidth="2" />
                    {/* Für Elise opening notes — E5 D#5 E5 D#5 E5 B4 D5 C5 (bar 1) A4 (bar 2 start) */}
                    {/* Treble noteheads — ellipses at staff positions */}
                    {[
                      // bar 1: E5 D#5 E5 D#5 E5 B4 D5 C5
                      { x: 80, y: 30, stem: 'up' },   // E5 (top line)
                      { x: 95, y: 34, stem: 'up', accidental: true },  // D#5
                      { x: 110, y: 30, stem: 'up' },  // E5
                      { x: 125, y: 34, stem: 'up', accidental: true },  // D#5
                      { x: 140, y: 30, stem: 'up' },  // E5
                      // bar 2: B4 D5 C5
                      { x: 165, y: 46, stem: 'up' },  // B4
                      { x: 183, y: 38, stem: 'up' },  // D5
                      { x: 200, y: 42, stem: 'up' },  // C5
                      // bar 3: A4
                      { x: 220, y: 50, stem: 'down' },  // A4
                      // bar 3 continuation
                      { x: 250, y: 58, stem: 'down' },  // E4
                      { x: 268, y: 50, stem: 'down' },  // A4
                      { x: 285, y: 46, stem: 'up' },    // B4
                      // bar 4
                      { x: 335, y: 42, stem: 'up' },    // C5
                      { x: 355, y: 30, stem: 'up' },    // E5
                      { x: 375, y: 34, stem: 'up' },    // D#5
                    ].map((n, i) => (
                      <g key={i} opacity="0.55">
                        {(n as any).accidental && (
                          <text x={n.x - 8} y={n.y + 4} fontSize="10" fill="#d4af37" fontFamily="serif">#</text>
                        )}
                        <ellipse cx={n.x} cy={n.y} rx="4.5" ry="3.2" fill="#d4af37" transform={`rotate(-15 ${n.x} ${n.y})`} />
                        {n.stem === 'up' ? (
                          <line x1={n.x + 4} y1={n.y} x2={n.x + 4} y2={n.y - 24} stroke="#d4af37" strokeWidth="0.8" />
                        ) : (
                          <line x1={n.x - 4} y1={n.y} x2={n.x - 4} y2={n.y + 24} stroke="#d4af37" strokeWidth="0.8" />
                        )}
                      </g>
                    ))}
                    {/* Bass clef notes — sparse accompaniment */}
                    {[
                      { x: 220, y: 111 },  // A2
                      { x: 250, y: 103 },  // E3
                      { x: 268, y: 107 },  // C3
                    ].map((n, i) => (
                      <g key={`bass-${i}`} opacity="0.4">
                        <ellipse cx={n.x} cy={n.y} rx="4.5" ry="3.2" fill="#d4af37" transform={`rotate(-15 ${n.x} ${n.y})`} />
                        <line x1={n.x - 4} y1={n.y} x2={n.x - 4} y2={n.y + 24} stroke="#d4af37" strokeWidth="0.8" />
                      </g>
                    ))}
                    {/* Beam groups (simplified) */}
                    <line x1="84" y1="6" x2="144" y2="6" stroke="#d4af37" strokeWidth="1.5" opacity="0.45" />
                  </svg>
                  <div className="demo-hint">Create, edit, and inscribe sheet music scores.</div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="canvas-video-wrap">
                {turnMode === 'slide' || !FlipBookView ? (
                  <CanvasPreview
                    spread={currentSpread}
                    selectedId={selectedId}
                    logos={logos}
                    pageNumber={currentSpread ? currentSpreadIndex + 1 : undefined}
                    onLogoPosChange={(pos) => updateSelectedSettings({ logoPos: pos })}
                    onSelectImage={(id) => setSelectedId(id)}
                    wrapperClassName={canvasWrapperClass}
                  />
                ) : (
                  <FlipBookView
                    spreads={spreads}
                    logos={logos}
                    activeIndex={currentSpreadIndex}
                    onPageChange={(idx: number) => {
                      const spread = spreads[idx];
                      if (spread) {
                        const imgs = spreadImages(spread);
                        setSelectedId(imgs[0].id);
                        setActiveSpreadIndex(idx);
                      }
                    }}
                  />
                )}
                {selectedImage?.mediaType === 'video' && !playingVideo && (
                  <button
                    className="video-play-overlay"
                    onClick={() => setPlayingVideo(true)}
                    title="Play video"
                  >
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="23" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="rgba(0,0,0,0.5)" />
                      <path d="M19 14L35 24L19 34V14Z" fill="rgba(255,255,255,0.9)" />
                    </svg>
                  </button>
                )}
                {selectedImage?.mediaType === 'video' && playingVideo && (
                  <div className="video-player-overlay">
                    <video
                      src={getVideoPlaybackUrl(selectedImage)}
                      controls
                      autoPlay
                    />
                    <button className="video-close-btn" onClick={() => setPlayingVideo(false)}>
                      Close
                    </button>
                  </div>
                )}
              </div>
              <div className="canvas-helper">
                <button
                  className="ghost spread-nav"
                  onClick={handlePrevSpread}
                  disabled={currentSpreadIndex <= 0}
                >
                  Prev
                </button>
                <span>
                  {currentSpread
                    ? `Page ${currentSpreadIndex + 1} of ${spreads.length}`
                    : 'Select an image to edit.'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="turn-toggle">
                    <button
                      className={`turn-toggle-btn ${turnMode === 'slide' ? 'active' : ''}`}
                      onClick={() => setTurnMode('slide')}
                    >
                      Slide
                    </button>
                    {FlipBookView && (
                      <button
                        className={`turn-toggle-btn ${turnMode === 'turn' ? 'active' : ''}`}
                        onClick={() => setTurnMode('turn')}
                      >
                        Turn
                      </button>
                    )}
                  </div>
                  <button
                    className="ghost spread-nav"
                    onClick={handleNextSpread}
                    disabled={currentSpreadIndex >= spreads.length - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {tokenisation.mode === 'currency' ? (
          <MintPanel
            doc={mint.doc}
            selectedLayer={mint.selectedLayer}
            selectedLayerId={mint.selectedLayerId}
            canUndo={mint.canUndo}
            canRedo={mint.canRedo}
            uvMode={mint.uvMode}
            onAddLayer={mint.addLayer}
            onRemoveLayer={mint.removeLayer}
            onReorderLayer={mint.reorderLayer}
            onUpdateConfig={mint.updateLayerConfig}
            onUpdateMeta={mint.updateLayerMeta}
            onUpdateTransform={mint.updateLayerTransform}
            onDuplicateLayer={mint.duplicateLayer}
            onSelectLayer={mint.selectLayer}
            onSetCanvasSize={mint.setCanvasSize}
            onSetBackgroundColor={mint.setBackgroundColor}
            onSetDocMeta={mint.setDocMeta}
            onSetUvMode={mint.setUvMode}
            onUndo={mint.undo}
            onRedo={mint.redo}
            onLoadDocument={mint.loadDocument}
            onExportPng={mint.exportPng}
            onExportBatchPng={mint.exportBatchPng}
            showGrid={showMintGrid}
            onToggleGrid={() => setShowMintGrid((prev) => !prev)}
            animatePreview={mintAnimate}
            onToggleAnimate={() => setMintAnimate((prev) => !prev)}
            getThumbnailSrc={mint.getLayerThumbnailSrc}
          />
        ) : tokenisation.mode === 'music' && MusicPanel && music ? (
          <MusicPanel
            score={music.score}
            selectedStaffId={music.selectedStaffId}
            selectedMeasureIdx={music.selectedMeasureIdx}
            selectedNoteIdx={music.selectedNoteIdx}
            currentTool={music.currentTool}
            currentDuration={music.currentDuration}
            dotted={music.dotted}
            canUndo={music.canUndo}
            canRedo={music.canRedo}
            onSetTool={music.setCurrentTool}
            onSetDuration={music.setCurrentDuration}
            onSetDotted={music.setDotted}
            onSetTitle={(title: string) => music.updateScoreMeta({ title })}
            onSetComposer={(composer: string) => music.updateScoreMeta({ composer })}
            onSetKeySignature={music.setKeySignature}
            onSetTimeSignature={music.setTimeSignature}
            onSetTempo={music.setTempo}
            onAddStaff={music.addStaff}
            onRemoveStaff={music.removeStaff}
            onUpdateStaffClef={music.updateStaffClef}
            onUpdateStaffName={music.updateStaffName}
            onAddMeasure={music.addMeasure}
            onUndo={music.undo}
            onRedo={music.redo}
            onExportPng={music.exportPng}
            onExportSvg={music.exportSvg}
          />
        ) : tokenisation.mode === 'tokenise' ? (
          <TokenisePanel
            selectedImage={selectedImage}
            stampPath={stampPath}
            onStampPathChange={setStampPath}
            extractedFrames={currentFrames}
            extractionProgress={tokenisation.extractionProgress}
            onExtractFrames={handleExtractFrames}
            onClearFrames={handleClearFrames}
            audioSegments={currentSegments}
            selectedPieceCount={tokenisation.selectedPieceIds.size}
            totalPieces={
              selectedImage?.mediaType === 'video' ? currentFrames.length :
              selectedImage?.mediaType === 'audio' ? currentSegments.length : 1
            }
            isStamping={isStamping}
            onStampPieces={handleStampPieces}
            onMintPieces={handleMintPieces}
            isMinting={isMinting}
            mintingProgress={tokenisation.mintingProgress}
            lastReceipt={lastReceipt}
          />
        ) : tokenisation.mode === 'music' && !MusicPanel ? (
          <aside className="panel right-panel">
            <h2>Music</h2>
            <div className="section">
              <h3>Notation Tools</h3>
              <div className="control-group">
                <div className="small" style={{ color: 'var(--accent-dim)', marginBottom: 4 }}>Desktop Features</div>
                <div className="small" style={{ opacity: 0.6 }}>Note entry &middot; Rest &middot; Accidentals</div>
                <div className="small" style={{ opacity: 0.6 }}>Clef selection &middot; Key signature</div>
                <div className="small" style={{ opacity: 0.6 }}>Time signature &middot; Tempo</div>
                <div className="small" style={{ opacity: 0.6 }}>Multi-staff &middot; Measures</div>
              </div>
            </div>
            <div className="section">
              <h3>Export</h3>
              <div className="control-group">
                <div className="small" style={{ opacity: 0.6 }}>PNG &middot; SVG &middot; On-chain inscription</div>
              </div>
            </div>
            <div className="section">
              <h3>Get Started</h3>
              <div className="control-group">
                <div className="small">Download the desktop app for the full notation editor with playback, multi-staff scoring, and direct export.</div>
              </div>
              {showDownloadButton && (
                <a
                  href="https://github.com/b0ase/bcorp-mint/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary"
                  style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}
                >
                  Download Desktop
                </a>
              )}
            </div>
          </aside>
        ) : (
        <aside className="panel right-panel">
          <h2>Settings</h2>
          {selectedImage ? (
            <>
              <div className="section">
                <h3>Vignette</h3>
                <div className="control-group">
                  <label className="control-row">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={selectedImage.settings.vignetteEnabled}
                      onChange={(event) =>
                        updateSelectedSettings({ vignetteEnabled: event.target.checked })
                      }
                    />
                  </label>
                  <label className="control-row">
                    <span>Strength</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedImage.settings.vignetteStrength}
                      onChange={(event) =>
                        updateSelectedSettings({ vignetteStrength: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="section">
                <h3>Frame</h3>
                <div className="control-group">
                  <label className="control-row">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={selectedImage.settings.frameEnabled}
                      onChange={(event) =>
                        updateSelectedSettings({ frameEnabled: event.target.checked })
                      }
                    />
                  </label>
                  <label className="control-row">
                    <span>Thickness</span>
                    <input
                      type="range"
                      min="0"
                      max="0.12"
                      step="0.005"
                      value={selectedImage.settings.frameThickness}
                      onChange={(event) =>
                        updateSelectedSettings({ frameThickness: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="control-row">
                    <span>Color</span>
                    <input
                      type="color"
                      value={selectedImage.settings.frameColor}
                      onChange={(event) => updateSelectedSettings({ frameColor: event.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="section">
                <h3>Logo</h3>
                <div className="control-group">
                  <label className="control-row">
                    <span>Size</span>
                    <input
                      type="range"
                      min="0.05"
                      max="1.0"
                      step="0.01"
                      value={selectedImage.settings.logoScale}
                      onChange={(event) =>
                        updateSelectedSettings({ logoScale: Number(event.target.value) })
                      }
                    />
                  </label>
                  <div className="control-row">
                    <button className="secondary" onClick={() => updateSelectedSettings({ logoPos: { x: 0.82, y: 0.86 } })}>
                      Reset Position
                    </button>
                    <button className="ghost" onClick={handleApplyLogoToAll}>
                      Apply To All
                    </button>
                  </div>
                </div>
              </div>

              <div className="section">
                <h3>Logo Gallery</h3>
                <div className="logo-grid">
                  {logos.map((logo) => (
                    <div
                      key={logo.id}
                      className={`logo-item ${selectedImage.settings.logoId === logo.id ? 'active' : ''}`}
                      onClick={() => updateSelectedSettings({ logoId: logo.id })}
                      title={logo.name}
                    >
                      <img src={logo.src} alt={logo.name} />
                    </div>
                  ))}
                </div>
                <button className="secondary" onClick={handleImportLogo}>
                  Import Logo
                </button>
                <button className="secondary" onClick={() => setShowLogoDesigner(true)}>
                  Design Logo
                </button>
              </div>

              <div className="section">
                <h3>Create Logo</h3>
                <div className="control-group">
                  <label className="control-row">
                    <span>Text</span>
                    <input
                      type="text"
                      value={logoForm.text}
                      onChange={(event) => setLogoForm((prev) => ({ ...prev, text: event.target.value }))}
                    />
                  </label>
                  <label className="control-row">
                    <span>Style</span>
                    <select
                      value={logoForm.style}
                      onChange={(event) =>
                        setLogoForm((prev) => ({ ...prev, style: event.target.value as GeneratedLogoStyle }))
                      }
                    >
                      <option value="solid">Solid</option>
                      <option value="outline">Outline</option>
                      <option value="stamp">Stamp</option>
                    </select>
                  </label>
                  <label className="control-row">
                    <span>Color</span>
                    <input
                      type="color"
                      value={logoForm.color}
                      onChange={(event) => setLogoForm((prev) => ({ ...prev, color: event.target.value }))}
                    />
                  </label>
                  <button onClick={handleCreateLogo}>Add Logo</button>
                </div>
              </div>

              <div className="section">
                <h3>Stamp</h3>
                <div className="control-group">
                  <label className="control-row">
                    <span>Path</span>
                    <input
                      type="text"
                      value={stampPath}
                      onChange={(e) => {
                        setStampPath(e.target.value);
                        if (selectedImage?.settings.stampVisual.borderStampEnabled) {
                          updateSelectedSettings({
                            stampVisual: { ...selectedImage.settings.stampVisual, borderStampText: e.target.value }
                          });
                        }
                      }}
                      placeholder="$TOKEN/SERIES/ISSUE"
                    />
                  </label>
                  <label className="control-row">
                    <span>Watermark</span>
                    <input
                      type="checkbox"
                      checked={selectedImage.settings.stampVisual.watermarkEnabled}
                      onChange={(e) =>
                        updateSelectedSettings({
                          stampVisual: { ...selectedImage.settings.stampVisual, watermarkEnabled: e.target.checked }
                        })
                      }
                    />
                  </label>
                  {selectedImage.settings.stampVisual.watermarkEnabled && (
                    <>
                      <label className="control-row">
                        <span>Text</span>
                        <input
                          type="text"
                          value={selectedImage.settings.stampVisual.watermarkText}
                          onChange={(e) =>
                            updateSelectedSettings({
                              stampVisual: { ...selectedImage.settings.stampVisual, watermarkText: e.target.value }
                            })
                          }
                        />
                      </label>
                      <label className="control-row">
                        <span>Opacity</span>
                        <input
                          type="range"
                          min="0.02"
                          max="0.5"
                          step="0.01"
                          value={selectedImage.settings.stampVisual.watermarkOpacity}
                          onChange={(e) =>
                            updateSelectedSettings({
                              stampVisual: { ...selectedImage.settings.stampVisual, watermarkOpacity: Number(e.target.value) }
                            })
                          }
                        />
                      </label>
                      <label className="control-row">
                        <span>Position</span>
                        <select
                          value={selectedImage.settings.stampVisual.watermarkPosition}
                          onChange={(e) =>
                            updateSelectedSettings({
                              stampVisual: { ...selectedImage.settings.stampVisual, watermarkPosition: e.target.value as 'center' | 'diagonal' | 'bottom-right' }
                            })
                          }
                        >
                          <option value="diagonal">Diagonal</option>
                          <option value="center">Center</option>
                          <option value="bottom-right">Bottom Right</option>
                        </select>
                      </label>
                    </>
                  )}
                  <label className="control-row">
                    <span>Border Stamp</span>
                    <input
                      type="checkbox"
                      checked={selectedImage.settings.stampVisual.borderStampEnabled}
                      onChange={(e) =>
                        updateSelectedSettings({
                          stampVisual: {
                            ...selectedImage.settings.stampVisual,
                            borderStampEnabled: e.target.checked,
                            borderStampText: e.target.checked ? stampPath : selectedImage.settings.stampVisual.borderStampText
                          }
                        })
                      }
                    />
                  </label>
                  <div className="control-row">
                    <button onClick={handleHashAndInscribe} disabled={isStamping}>
                      {isStamping ? 'Stamping\u2026' : 'Hash & Inscribe'}
                    </button>
                    <button className="secondary" onClick={handleMintToken} disabled={!lastReceipt || isMinting || !platform.mintStampToken}>
                      {isMinting ? 'Minting\u2026' : 'Mint Token'}
                    </button>
                  </div>
                  <div className="control-row">
                    <button className="ghost" onClick={handleBatchStamp} disabled={enabledImages.length === 0 || isStamping || !platform.hashFilesBatch}>
                      Stamp All ({enabledImages.length})
                    </button>
                    <button className="ghost" onClick={loadReceipts}>
                      Receipts
                    </button>
                    {DocumentHashPanel && (
                      <button className="ghost" onClick={() => setShowDocumentHash(true)}>
                        Doc Hashes
                      </button>
                    )}
                  </div>
                  {lastReceipt && (
                    <div className="stamp-receipt">
                      <div className="small" title={lastReceipt.hash}>
                        Hash: {lastReceipt.hash.slice(0, 12)}...{lastReceipt.hash.slice(-8)}
                      </div>
                      {lastReceipt.txid && (
                        <div className="small" title={lastReceipt.txid}>
                          TxID: {lastReceipt.txid.slice(0, 12)}...{lastReceipt.txid.slice(-8)}
                        </div>
                      )}
                      {!lastReceipt.txid && (
                        <div className="small" style={{ color: 'var(--muted)' }}>Local only (no wallet key)</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </>
          ) : (
            <>
              <div className="section">
                <h3>How It Works</h3>
                <div className="control-group">
                  <div className="small"><strong style={{ color: 'var(--accent-dim)' }}>1.</strong> Load images using Add Media or drag &amp; drop</div>
                  <div className="small"><strong style={{ color: 'var(--accent-dim)' }}>2.</strong> Adjust vignette, frame, logo, and watermark</div>
                  <div className="small"><strong style={{ color: 'var(--accent-dim)' }}>3.</strong> Set your stamp path (e.g. $TOKEN/SERIES/ISSUE)</div>
                  <div className="small"><strong style={{ color: 'var(--accent-dim)' }}>4.</strong> Hash &amp; Inscribe to write SHA-256 proof to BSV</div>
                </div>
              </div>
              <div className="section">
                <h3>Available Controls</h3>
                <div className="control-group">
                  <div className="small" style={{ opacity: 0.6 }}>Vignette &middot; strength &amp; edge darkening</div>
                  <div className="small" style={{ opacity: 0.6 }}>Frame &middot; border thickness &amp; color</div>
                  <div className="small" style={{ opacity: 0.6 }}>Logo &middot; position, scale, gallery</div>
                  <div className="small" style={{ opacity: 0.6 }}>Watermark &middot; text, opacity, position</div>
                  <div className="small" style={{ opacity: 0.6 }}>Stamp &middot; hash, inscribe, mint token</div>
                </div>
              </div>
            </>
          )}
        </aside>
        )}
      </div>

      <PageStrip
        spreads={spreads}
        allImages={images}
        activeIndex={currentSpreadIndex}
        enabledIds={currentIssue?.enabledIds ?? null}
        onPageClick={handlePageClick}
        onToggleImage={toggleImage}
        comfyConnected={platform.supportedFeatures.has('comfyui') ? comfyConnected : false}
        comfyModels={comfyModels}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        isAnimating={isAnimating}
        animateProgress={animateProgress}
        onAnimate={handleAnimate}
      />

      {showLogoDesigner && (
        <LogoDesigner
          onClose={() => setShowLogoDesigner(false)}
          onSave={(logo) => {
            setLogos((prev) => [logo, ...prev]);
            if (selectedImage) {
              updateSelectedSettings({ logoId: logo.id });
            }
            setShowLogoDesigner(false);
          }}
        />
      )}

      {showSplash && <SplashScreen onEnter={() => { localStorage.setItem('mint-splash-seen', '1'); setShowSplash(false); }} />}

      {/* Mint Vault Modal */}
      {showVault && (
        <div className="logo-designer-overlay" onClick={() => setShowVault(false)}>
          <div className="logo-designer" style={{ maxWidth: 900, maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="logo-designer-header">
              <h2>Mint Vault</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {vaultStatus && <span className="small" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{vaultStatus}</span>}
                <button className="secondary" onClick={handleSaveToVault} disabled={vaultLoading}>
                  {vaultLoading ? 'Working...' : 'Save Current'}
                </button>
                <button className="ghost" onClick={() => setShowVault(false)}>Close</button>
              </div>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(80vh - 60px)' }}>
              {vaultEntries.length === 0 ? (
                <div className="small" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                  No designs saved yet. Click &quot;Save Current&quot; to store your first design.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {vaultEntries.map((entry) => (
                    <div key={entry.id} style={{
                      background: 'var(--panel-2)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                    }}>
                      {/* Thumbnail */}
                      {entry.thumbnail && (
                        <div style={{ width: '100%', aspectRatio: '2/1', overflow: 'hidden', background: '#000' }}>
                          <img
                            src={entry.thumbnail}
                            alt={entry.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                      <div style={{ padding: 10 }}>
                        {/* Name + Date */}
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{entry.name}</div>
                        <div className="small" style={{ color: 'var(--muted)', marginBottom: 6 }}>
                          {new Date(entry.createdAt).toLocaleDateString()} &middot; {(entry.fileSize / 1024).toFixed(1)} KB
                        </div>
                        {/* Status Badge */}
                        <div style={{ marginBottom: 8 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            background: entry.status === 'on-chain' ? 'rgba(76,175,80,0.2)' : entry.status === 'uploading' ? 'rgba(255,193,7,0.2)' : 'rgba(158,158,158,0.2)',
                            color: entry.status === 'on-chain' ? '#4caf50' : entry.status === 'uploading' ? '#ffc107' : '#9e9e9e',
                          }}>
                            {entry.status === 'on-chain' ? 'On-Chain' : entry.status === 'uploading' ? 'Uploading...' : 'Local'}
                          </span>
                        </div>
                        {/* UHRP URL */}
                        {entry.uhrpUrl && (
                          <div className="small" style={{ fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6, wordBreak: 'break-all', color: 'var(--accent)' }}>
                            {entry.uhrpUrl.slice(0, 32)}...
                          </div>
                        )}
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="secondary" onClick={() => handleRestoreFromVault(entry.id)} style={{ flex: 1, fontSize: 11, padding: '4px 6px' }}>
                            Restore
                          </button>
                          {entry.status === 'local' && (
                            <button className="secondary" onClick={() => handleUploadToChain(entry.id)} disabled={vaultLoading} style={{ flex: 1, fontSize: 11, padding: '4px 6px' }}>
                              Upload
                            </button>
                          )}
                          <button className="ghost" onClick={() => handleDeleteVaultEntry(entry.id)} style={{ fontSize: 11, padding: '4px 6px', color: 'var(--danger)' }}>
                            Del
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDocumentHash && DocumentHashPanel && (
        <DocumentHashPanel
          walletProvider={walletMgr.walletState.provider === 'handcash' ? 'handcash' : 'local'}
          walletConnected={walletMgr.walletState.connected}
          onClose={() => setShowDocumentHash(false)}
        />
      )}

      <WalletView
        open={showWalletView}
        onClose={() => setShowWalletView(false)}
        onWalletChanged={walletMgr.refresh}
      />

      {showReceiptViewer && (
        <div className="logo-designer-overlay" onClick={() => setShowReceiptViewer(false)}>
          <div className="logo-designer" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="logo-designer-header">
              <h2>Stamp Receipts</h2>
              <button className="ghost" onClick={() => setShowReceiptViewer(false)}>Close</button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', maxHeight: '60vh' }}>
              {allReceipts.length === 0 ? (
                <div className="small">No stamps yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allReceipts.map((r) => (
                    <div key={r.id} className="stamp-receipt" style={{ background: 'var(--panel-2)', padding: 12, borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ fontSize: 13 }}>{r.path}</strong>
                        <span className="small">{new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="small">File: {r.sourceFile}</div>
                      <div className="small" style={{ fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer' }} title="Click to copy" onClick={() => navigator.clipboard.writeText(r.hash)}>
                        Hash: {r.hash.slice(0, 16)}...{r.hash.slice(-12)}
                      </div>
                      {r.txid && (
                        <div className="small" style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--accent)' }}>
                          TxID: {r.txid.slice(0, 16)}...{r.txid.slice(-12)}
                        </div>
                      )}
                      {r.tokenId && (
                        <div className="small" style={{ color: 'var(--accent-2)' }}>Token: {r.tokenId}</div>
                      )}
                      {!r.txid && <div className="small" style={{ color: 'var(--muted)' }}>Local only</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline helper: extract video thumbnail from URL (works in both Electron
// and Browser since it only needs a <video> element and canvas)
// ---------------------------------------------------------------------------

function loadVideoThumbnailFromUrl(
  streamUrl: string
): Promise<{ width: number; height: number; thumbnailUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video thumbnail extraction timed out'));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          thumbnailUrl
        });
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video: ${streamUrl}`));
    };

    video.src = streamUrl;
  });
}
