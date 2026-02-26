import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasPreview from './components/CanvasPreview';
import FlipBookView from './components/FlipBookView';
import FrameBrowser from './components/FrameBrowser';
import LogoDesigner from './components/LogoDesigner';
import MintCanvas from './components/MintCanvas';
import MintPanel from './components/MintPanel';
import ModeToggle from './components/ModeToggle';
import MusicCanvas from './components/MusicCanvas';
import MusicPanel from './components/MusicPanel';
import PageStrip from './components/PageStrip';
import SplashScreen from './components/SplashScreen';
import TokenisePanel from './components/TokenisePanel';
import WaveformEditor from './components/WaveformEditor';
import WalletSelector from './components/WalletSelector';
import MetaNetTreeView from './components/MetaNetTreeView';
import FilePreviewCanvas from './components/FilePreviewCanvas';
import ProtocolConditionPanel from './components/ProtocolConditionPanel';
import BatchInscriptionPanel from './components/BatchInscriptionPanel';
import DocumentHashPanel from './components/DocumentHashPanel';
import { createDefaultSettings } from './lib/defaults';
import { isAudioFile, isVideoFile, loadImage, loadVideoThumbnail, mediaStreamUrl } from './lib/image-utils';
import { createTextLogo, initialLogos, type GeneratedLogoStyle } from './lib/logos';
import type { ActiveIssue, AppMode, AudioSegment, ExtractedFrame, ImageItem, ImageSettings, LogoAsset, Spread, StampReceipt, WalletState, WalletProviderType } from './lib/types';
import { useMintDesigner } from './hooks/useMintDesigner';
import { useMusicEditor } from './hooks/useMusicEditor';
import { useTokenisation } from './hooks/useTokenisation';
import { useWalletManager } from './hooks/useWalletManager';
import { useMetaNetTree } from './hooks/useMetaNetTree';
import { conditionToOnChain } from './lib/protocol-conditions';

const SUPPORTED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp',
  '.mp4', '.mov', '.webm', '.avi',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'
]);

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

export default function App() {
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
  const [allReceipts, setAllReceipts] = useState<StampReceipt[]>([]);

  // Tokenisation state
  const tokenisation = useTokenisation();
  const [audioPeaks, setAudioPeaks] = useState<Map<string, number[]>>(new Map());

  // Mint (Currency Designer) state
  const mint = useMintDesigner();
  const [showMintGrid, setShowMintGrid] = useState(false);
  const [mintAnimate, setMintAnimate] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Music Editor state
  const music = useMusicEditor();

  // Wallet manager + MetaNet tree (Phase 2+4)
  const walletMgr = useWalletManager();
  const metanetTree = useMetaNetTree();

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
    const map = new Map<string, string>(); // imageId → partnerId
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

  // --- Issue management (in-memory, folder-based) ---

  const handleNewIssue = async () => {
    const parentDir = await window.mint.chooseExportFolder();
    if (!parentDir) return;
    const num = await window.mint.nextIssueNumber(parentDir);
    const name = `mint-${String(num).padStart(3, '0')}`;
    const id = crypto.randomUUID();

    const newIssue: ActiveIssue = { id, name, num, parentDir, enabledIds: new Set() };
    setIssues((prev) => [...prev, newIssue]);
    setCurrentIssueId(id);
  };

  const switchIssue = (id: string) => {
    setCurrentIssueId(id);
  };

  // --- Image toggle (add/remove from current issue) ---

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

  // --- Image loading ---

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

  const loadFilePaths = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;
    const defaultLogoId = logos[0]?.id ?? 'mint-outline';

    const results = await Promise.all(
      filePaths.map(async (filePath): Promise<ImageItem | null> => {
        try {
          const name = await window.mint.basename(filePath);

          if (isAudioFile(filePath)) {
            // Probe audio metadata
            const probe = await window.mint.probeMedia(filePath);
            // Generate waveform thumbnail
            let waveformUrl = '';
            try {
              const tempPath = `${filePath}.waveform.png`;
              await window.mint.generateWaveform({ filePath, outputPath: tempPath, width: 400, height: 80 });
              waveformUrl = await window.mint.fileUrl(tempPath);
            } catch {
              // Fallback: use a placeholder
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

          if (isVideoFile(filePath)) {
            const streamUrl = mediaStreamUrl(filePath);
            const { width, height, thumbnailUrl } = await loadVideoThumbnail(streamUrl);
            // Probe video metadata
            let probe: { duration: number; fps: number; } | undefined;
            try {
              probe = await window.mint.probeMedia(filePath);
            } catch { /* non-critical */ }
            return {
              id: crypto.randomUUID(),
              path: filePath,
              name,
              url: thumbnailUrl,
              width,
              height,
              mediaType: 'video' as const,
              duration: probe?.duration,
              frameRate: probe?.fps,
              totalFrames: probe ? Math.floor(probe.duration * probe.fps) : undefined,
              settings: createDefaultSettings(defaultLogoId)
            };
          }

          const url = await window.mint.fileUrl(filePath);
          const img = await loadImage(url);
          return {
            id: crypto.randomUUID(),
            path: filePath,
            name,
            url,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            mediaType: 'image' as const,
            settings: createDefaultSettings(defaultLogoId)
          };
        } catch (err) {
          console.error(`Failed to load ${filePath}:`, err);
          return null;
        }
      })
    );
    const items = results.filter((item): item is ImageItem => item !== null);

    setImages((prev) => [...prev, ...items]);
    setSelectedId((prev) => prev ?? items[0]?.id ?? null);
  }, [logos]);

  const handleSelectFolder = async () => {
    const result = await window.mint.selectFolder();
    if (!result) return;
    await loadFilePaths(result.files);
  };

  const handleSelectFiles = async () => {
    const result = await window.mint.openImages();
    if (!result) return;
    await loadFilePaths(result);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const paths = files
      .filter((f) => SUPPORTED_EXT.has(`.${f.name.split('.').pop()?.toLowerCase()}`))
      .map((f) => (f as File & { path: string }).path)
      .filter(Boolean);
    await loadFilePaths(paths);
  }, [loadFilePaths]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // --- Page navigation with turn animation ---

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
          const idx = mint.doc.layers.findIndex((l) => l.id === mint.selectedLayerId);
          if (idx > 0) mint.reorderLayer(mint.selectedLayerId, idx - 1);
          return;
        }
        if (e.key === ']' && mint.selectedLayerId) {
          e.preventDefault();
          const idx = mint.doc.layers.findIndex((l) => l.id === mint.selectedLayerId);
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

  // --- Fullscreen ---

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

  // --- ComfyUI ---

  // Check ComfyUI connection on mount and periodically; fetch models when connected
  useEffect(() => {
    const check = async () => {
      try {
        const connected = await window.mint.comfyCheck();
        setComfyConnected(connected);
        if (connected) {
          const models = await window.mint.comfyListModels();
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
  }, []);

  // Listen for ComfyUI progress events
  useEffect(() => {
    const cleanup = window.mint.onComfyProgress((data) => {
      setAnimateProgress(data);
    });
    return cleanup;
  }, []);

  // Poll wallet status
  useEffect(() => {
    const check = async () => {
      try {
        const state = await window.mint.walletStatus();
        setWalletState(state);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Stamp handlers ---

  const handleHashAndInscribe = async () => {
    if (!selectedImage || isStamping) return;
    setIsStamping(true);
    try {
      const { hash, size } = await window.mint.hashFile(selectedImage.path);
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

      await window.mint.saveStampReceipt(JSON.stringify(receipt));
      setLastReceipt(receipt);

      // Inscribe if wallet has a key
      try {
        const hasKey = await window.mint.keystoreHasKey();
        if (hasKey) {
          const { txid } = await window.mint.inscribeStamp({ path: stampPath, hash, timestamp });
          const updated = await window.mint.updateStampReceipt(receipt.id, { txid });
          setLastReceipt(updated);
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
    if (!lastReceipt || isMinting) return;
    setIsMinting(true);
    try {
      const { tokenId } = await window.mint.mintStampToken({
        path: lastReceipt.path,
        hash: lastReceipt.hash,
        name: stampPath.split('/').pop() || 'STAMP'
      });
      const updated = await window.mint.updateStampReceipt(lastReceipt.id, { tokenId });
      setLastReceipt(updated);
    } catch (err) {
      console.error('Mint failed:', err);
      alert(`Mint failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleBatchStamp = async () => {
    if (enabledImages.length === 0 || isStamping) return;
    setIsStamping(true);
    try {
      const paths = enabledImages.map((img) => img.path);
      const results = await window.mint.hashFilesBatch(paths);

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

        await window.mint.saveStampReceipt(JSON.stringify(receipt));

        try {
          const hasKey = await window.mint.keystoreHasKey();
          if (hasKey) {
            const { txid } = await window.mint.inscribeStamp({ path: pagePath, hash, timestamp });
            await window.mint.updateStampReceipt(receipt.id, { txid });
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

  // --- Tokenise handlers ---

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

  // Load audio peaks when selecting an audio item
  useEffect(() => {
    if (!selectedImage || selectedImage.mediaType !== 'audio') return;
    if (audioPeaks.has(selectedImage.id)) return;
    window.mint.getAudioPeaks(selectedImage.path, 2000).then((peaks) => {
      setAudioPeaks((prev) => new Map(prev).set(selectedImage.id, peaks));
    }).catch(console.error);
  }, [selectedImage, audioPeaks]);

  const handleStampPieces = async () => {
    if (!selectedImage || isStamping) return;
    setIsStamping(true);
    try {
      const isVideo = selectedImage.mediaType === 'video';
      const isAudio = selectedImage.mediaType === 'audio';

      if (isVideo && currentFrames.length > 0) {
        const frames = tokenisation.selectedPieceIds.size > 0
          ? currentFrames.filter((f) => tokenisation.selectedPieceIds.has(f.id))
          : currentFrames;
        const paths = frames.map((f) => f.path);
        const results = await window.mint.hashFilesBatch(paths);
        const sourceHash = (await window.mint.hashFile(selectedImage.path)).hash;

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
          await window.mint.saveStampReceipt(JSON.stringify(receipt));

          try {
            const hasKey = await window.mint.keystoreHasKey();
            if (hasKey) {
              const { txid } = await window.mint.inscribeStamp({
                path: piecePath, hash, timestamp,
                parentHash: sourceHash, pieceIndex: frame.frameIndex, totalPieces: currentFrames.length
              });
              await window.mint.updateStampReceipt(receipt.id, { txid });
            }
          } catch { /* continue */ }
        }
        setLastReceipt({ id: '', path: stampPath, hash: `${frames.length} frames`, algorithm: 'sha256', sourceFile: selectedImage.name, sourceSize: 0, timestamp: new Date().toISOString(), txid: null, tokenId: null, metadata: {} });
      } else if (isAudio && currentSegments.length > 0) {
        // Extract and hash audio segments
        const sourceHash = (await window.mint.hashFile(selectedImage.path)).hash;
        for (let i = 0; i < currentSegments.length; i++) {
          const seg = currentSegments[i];
          const timestamp = new Date().toISOString();
          const padded = String(seg.segmentIndex).padStart(3, '0');
          const piecePath = `${stampPath}/SEGMENT-${padded}`;

          // Extract segment to temp file, then hash
          const tempPath = `${selectedImage.path}.seg-${padded}.wav`;
          await window.mint.extractAudioSegment({ filePath: selectedImage.path, outputPath: tempPath, startTime: seg.startTime, endTime: seg.endTime });
          const { hash, size } = await window.mint.hashFile(tempPath);

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
          await window.mint.saveStampReceipt(JSON.stringify(receipt));

          try {
            const hasKey = await window.mint.keystoreHasKey();
            if (hasKey) {
              const { txid } = await window.mint.inscribeStamp({
                path: piecePath, hash, timestamp,
                parentHash: sourceHash, pieceIndex: seg.segmentIndex, totalPieces: currentSegments.length
              });
              await window.mint.updateStampReceipt(receipt.id, { txid });
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

      if (isVideo && currentFrames.length > 0) {
        const frames = tokenisation.selectedPieceIds.size > 0
          ? currentFrames.filter((f) => tokenisation.selectedPieceIds.has(f.id))
          : currentFrames;

        const pieces = frames.map((f) => {
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

        await window.mint.batchMintTokens(pieces);
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
      await window.mint.walletDisconnect();
      setWalletState({ connected: false, handle: null, authToken: null, balance: null });
    } else {
      const state = await window.mint.walletConnect();
      setWalletState(state);
    }
  };

  const loadReceipts = async () => {
    const receipts = await window.mint.listStampReceipts();
    setAllReceipts(receipts);
    setShowReceiptViewer(true);
  };

  const handleAnimate = async () => {
    if (!selectedImage || isAnimating) return;
    setIsAnimating(true);
    setAnimateResult(null);
    setAnimateProgress(null);
    try {
      // Output to the issue folder or prompt for one
      let outputDir: string;
      if (currentIssue) {
        outputDir = `${currentIssue.parentDir}/${currentIssue.name}`;
      } else {
        const picked = await window.mint.chooseExportFolder();
        if (!picked) { setIsAnimating(false); return; }
        outputDir = picked;
      }
      const result = await window.mint.comfyAnimate(selectedImage.path, outputDir, {
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

  // --- Logo / Export ---

  const handleImportLogo = async () => {
    const filePath = await window.mint.openLogo();
    if (!filePath) return;
    const src = await window.mint.fileUrl(filePath);
    const name = await window.mint.basename(filePath);

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
    if (!currentIssue || enabledImages.length === 0) return;
    setIsExporting(true);
    try {
      const cover = enabledImages[0];
      const body = enabledImages.slice(1);
      await window.mint.createIssue(
        currentIssue.parentDir,
        currentIssue.num,
        cover.path,
        body.map((img) => img.path)
      );
    } finally {
      setIsExporting(false);
    }
  };

  const canvasWrapperClass = [
    'canvas-wrapper',
    turnDirection === 'left' && 'turning-left',
    turnDirection === 'right' && 'turning-right'
  ].filter(Boolean).join(' ');

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
          <button className="secondary" onClick={handleSelectFolder}>
            Load Folder
          </button>
          <button className="secondary" onClick={handleSelectFiles}>
            Add Files
          </button>
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
          <h2>Images</h2>
          <div className="image-list">
            {images.length === 0 ? (
              <div className="empty-sidebar">
                <div className="empty-sidebar-icon">{'\u25C8'}</div>
                <div className="small">Drop files here or use the buttons above to load media.</div>
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
          ) : /* Music mode: Sheet Music Notation Editor */
          tokenisation.mode === 'music' ? (
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
          ) : /* Tokenise mode: show FrameBrowser or WaveformEditor */
          tokenisation.mode === 'tokenise' && selectedImage?.mediaType === 'video' && currentFrames.length > 0 ? (
            <FrameBrowser
              frames={currentFrames}
              selectedIds={tokenisation.selectedPieceIds}
              onSelectFrame={(id, multi) => tokenisation.selectPiece(id, multi)}
              onSelectRange={(ids) => tokenisation.selectPieceRange(ids)}
              onSelectEveryNth={(n) => selectedId && tokenisation.selectEveryNth(selectedId, n)}
              onSelectAll={() => selectedId && tokenisation.selectAllPieces(selectedId)}
            />
          ) : tokenisation.mode === 'tokenise' && selectedImage?.mediaType === 'audio' && currentPeaks.length > 0 ? (
            <WaveformEditor
              filePath={selectedImage.path}
              duration={selectedImage.duration || 0}
              peaks={currentPeaks}
              segments={currentSegments}
              onSegmentsChange={handleAudioSegmentsChange}
              parentId={selectedImage.id}
            />
          ) : images.length === 0 ? (
            <div className={`canvas-empty-state ${tokenisation.mode === 'tokenise' ? 'tokenise-empty' : 'stamp-empty'}`}>
              <div className="canvas-empty-content">
                <div className="canvas-empty-icon">
                  {tokenisation.mode === 'tokenise' ? '\u2699' : '\u2756'}
                </div>
                <div className="canvas-empty-title">
                  {tokenisation.mode === 'tokenise' ? 'Tokenise Media' : 'Load Media to Begin'}
                </div>
                <div className="canvas-empty-hint">
                  {tokenisation.mode === 'tokenise'
                    ? 'Load video or audio files to extract frames and segments for tokenisation.'
                    : 'Drop files here, or use Load Folder / Add Media above to start framing and stamping.'}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="canvas-video-wrap">
                {turnMode === 'slide' ? (
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
                    onPageChange={(idx) => {
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
                      src={mediaStreamUrl(selectedImage.path)}
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
                    <button
                      className={`turn-toggle-btn ${turnMode === 'turn' ? 'active' : ''}`}
                      onClick={() => setTurnMode('turn')}
                    >
                      Turn
                    </button>
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
        ) : tokenisation.mode === 'music' ? (
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
            onSetTitle={(title) => music.updateScoreMeta({ title })}
            onSetComposer={(composer) => music.updateScoreMeta({ composer })}
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
                    <button className="secondary" onClick={handleMintToken} disabled={!lastReceipt || isMinting}>
                      {isMinting ? 'Minting\u2026' : 'Mint Token'}
                    </button>
                  </div>
                  <div className="control-row">
                    <button className="ghost" onClick={handleBatchStamp} disabled={enabledImages.length === 0 || isStamping}>
                      Stamp All ({enabledImages.length})
                    </button>
                    <button className="ghost" onClick={loadReceipts}>
                      Receipts
                    </button>
                    <button className="ghost" onClick={() => setShowDocumentHash(true)}>
                      Doc Hashes
                    </button>
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
            <div className="small">Pick an image to edit its settings.</div>
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
        comfyConnected={comfyConnected}
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

      {showSplash && <SplashScreen onEnter={() => setShowSplash(false)} />}

      {showDocumentHash && (
        <DocumentHashPanel
          walletProvider={walletMgr.walletState.provider === 'handcash' ? 'handcash' : 'local'}
          walletConnected={walletMgr.walletState.connected}
          onClose={() => setShowDocumentHash(false)}
        />
      )}

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
