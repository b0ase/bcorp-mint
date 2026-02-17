import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasPreview from './components/CanvasPreview';
import FlipBookView from './components/FlipBookView';
import LogoDesigner from './components/LogoDesigner';
import PageStrip from './components/PageStrip';
import { createDefaultSettings } from './lib/defaults';
import { loadImage } from './lib/image-utils';
import { createTextLogo, initialLogos, type GeneratedLogoStyle } from './lib/logos';
import type { ActiveIssue, ImageItem, ImageSettings, LogoAsset, Spread, StampReceipt, WalletState } from './lib/types';

const SUPPORTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp']);

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
    text: 'NPG',
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

  // Stamp state
  const [stampPath, setStampPath] = useState('$NPG/SERIES-01/ISSUE-1');
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, handle: null, authToken: null, balance: null });
  const [lastReceipt, setLastReceipt] = useState<StampReceipt | null>(null);
  const [isStamping, setIsStamping] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [allReceipts, setAllReceipts] = useState<StampReceipt[]>([]);

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

  // --- Issue management (in-memory, folder-based) ---

  const handleNewIssue = async () => {
    const parentDir = await window.npg.chooseExportFolder();
    if (!parentDir) return;
    const num = await window.npg.nextIssueNumber(parentDir);
    const name = `npgx-${String(num).padStart(3, '0')}`;
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
    const defaultLogoId = logos[0]?.id ?? 'npg-outline';

    const items = await Promise.all(
      filePaths.map(async (filePath) => {
        const [url, name] = await Promise.all([
          window.npg.fileUrl(filePath),
          window.npg.basename(filePath)
        ]);
        const img = await loadImage(url);
        return {
          id: crypto.randomUUID(),
          path: filePath,
          name,
          url,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          settings: createDefaultSettings(defaultLogoId)
        } as ImageItem;
      })
    );

    setImages((prev) => [...prev, ...items]);
    setSelectedId((prev) => prev ?? items[0]?.id ?? null);
  }, [logos]);

  const handleSelectFolder = async () => {
    const result = await window.npg.selectFolder();
    if (!result) return;
    await loadFilePaths(result.files);
  };

  const handleSelectFiles = async () => {
    const result = await window.npg.openImages();
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

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
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
  }, [handlePrevSpread, handleNextSpread]);

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
        const connected = await window.npg.comfyCheck();
        setComfyConnected(connected);
        if (connected) {
          const models = await window.npg.comfyListModels();
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

  // Poll wallet status
  useEffect(() => {
    const check = async () => {
      try {
        const state = await window.npg.walletStatus();
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
      const { hash, size } = await window.npg.hashFile(selectedImage.path);
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

      await window.npg.saveStampReceipt(JSON.stringify(receipt));
      setLastReceipt(receipt);

      // Inscribe if wallet has a key
      try {
        const hasKey = await window.npg.keystoreHasKey();
        if (hasKey) {
          const { txid } = await window.npg.inscribeStamp({ path: stampPath, hash, timestamp });
          const updated = await window.npg.updateStampReceipt(receipt.id, { txid });
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
      const { tokenId } = await window.npg.mintStampToken({
        path: lastReceipt.path,
        hash: lastReceipt.hash,
        name: stampPath.split('/').pop() || 'STAMP'
      });
      const updated = await window.npg.updateStampReceipt(lastReceipt.id, { tokenId });
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
      const results = await window.npg.hashFilesBatch(paths);

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

        await window.npg.saveStampReceipt(JSON.stringify(receipt));

        try {
          const hasKey = await window.npg.keystoreHasKey();
          if (hasKey) {
            const { txid } = await window.npg.inscribeStamp({ path: pagePath, hash, timestamp });
            await window.npg.updateStampReceipt(receipt.id, { txid });
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

  const handleWalletConnect = async () => {
    if (walletState.connected) {
      await window.npg.walletDisconnect();
      setWalletState({ connected: false, handle: null, authToken: null, balance: null });
    } else {
      const state = await window.npg.walletConnect();
      setWalletState(state);
    }
  };

  const loadReceipts = async () => {
    const receipts = await window.npg.listStampReceipts();
    setAllReceipts(receipts);
    setShowReceiptViewer(true);
  };

  const handleAnimate = async () => {
    if (!selectedImage || isAnimating) return;
    setIsAnimating(true);
    setAnimateResult(null);
    try {
      // Output to the issue folder or prompt for one
      let outputDir: string;
      if (currentIssue) {
        outputDir = `${currentIssue.parentDir}/${currentIssue.name}`;
      } else {
        const picked = await window.npg.chooseExportFolder();
        if (!picked) { setIsAnimating(false); return; }
        outputDir = picked;
      }
      const result = await window.npg.comfyAnimate(selectedImage.path, outputDir, {
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
    }
  };

  // --- Logo / Export ---

  const handleImportLogo = async () => {
    const filePath = await window.npg.openLogo();
    if (!filePath) return;
    const src = await window.npg.fileUrl(filePath);
    const name = await window.npg.basename(filePath);

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
      await window.npg.createIssue(
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
          <h1 className="brand-title">NPGX Stamp</h1>
          <button className="wallet-status" onClick={handleWalletConnect} title={walletState.handle || 'Connect wallet'}>
            <span className={`wallet-dot ${walletState.connected ? 'connected' : ''}`} />
            {walletState.connected ? walletState.handle || 'Connected' : 'Connect Wallet'}
          </button>
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
          <button className="secondary" onClick={handleSelectFolder}>
            Load Folder
          </button>
          <button className="secondary" onClick={handleSelectFiles}>
            Add Images
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
              <div className="small">No images loaded.</div>
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
                    <img src={image.url} alt={image.name} />
                    <div className="image-meta">
                      <strong>{image.name}</strong>
                      <span>
                        {image.width > image.height ? 'L' : 'P'}
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
        </section>

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
                      max="0.4"
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
                <h3>Create NPG Logo</h3>
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
                      placeholder="$NPG/SERIES-01/ISSUE-1"
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
