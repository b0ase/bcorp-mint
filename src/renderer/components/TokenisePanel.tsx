import React, { useState } from 'react';
import type { AudioSegment, ExtractedFrame, ImageItem, StampReceipt } from '../lib/types';

type Props = {
  selectedImage: ImageItem | null;
  stampPath: string;
  onStampPathChange: (path: string) => void;

  // Video extraction
  extractedFrames: ExtractedFrame[];
  extractionProgress: { completed: number; total: number; stage: string } | null;
  onExtractFrames: (interval: number, maxFrames: number, quality: 'low' | 'medium' | 'high') => void;
  onClearFrames: () => void;

  // Audio segmentation
  audioSegments: AudioSegment[];

  // Piece selection
  selectedPieceCount: number;
  totalPieces: number;

  // Stamping
  isStamping: boolean;
  onStampPieces: () => void;
  onMintPieces: () => void;
  isMinting: boolean;
  mintingProgress: { completed: number; total: number } | null;
  lastReceipt: StampReceipt | null;
};

export default function TokenisePanel({
  selectedImage,
  stampPath,
  onStampPathChange,
  extractedFrames,
  extractionProgress,
  onExtractFrames,
  onClearFrames,
  audioSegments,
  selectedPieceCount,
  totalPieces,
  isStamping,
  onStampPieces,
  onMintPieces,
  isMinting,
  mintingProgress,
  lastReceipt
}: Props) {
  const [interval, setInterval] = useState(1);
  const [maxFrames, setMaxFrames] = useState(500);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');

  if (!selectedImage) {
    return (
      <aside className="panel right-panel">
        <h2>Tokenise</h2>
        <div className="small">Select media to tokenise.</div>
      </aside>
    );
  }

  const hasFrames = extractedFrames.length > 0;
  const hasSegments = audioSegments.length > 0;
  const isVideo = selectedImage.mediaType === 'video';
  const isAudio = selectedImage.mediaType === 'audio';
  const isImage = selectedImage.mediaType === 'image';

  return (
    <aside className="panel right-panel">
      <h2>Tokenise</h2>

      {/* Source info */}
      <div className="section">
        <h3>Source</h3>
        <div className="control-group">
          <div className="small">{selectedImage.name}</div>
          {isVideo && (
            <>
              <div className="small">
                {selectedImage.width}x{selectedImage.height} &middot; {selectedImage.frameRate?.toFixed(1) || '?'} fps
              </div>
              <div className="small">
                Duration: {selectedImage.duration ? `${Math.floor(selectedImage.duration)}s` : 'Unknown'}
              </div>
            </>
          )}
          {isAudio && (
            <>
              <div className="small">
                {selectedImage.sampleRate ? `${selectedImage.sampleRate} Hz` : ''} &middot; {selectedImage.channels || '?'} ch
              </div>
              <div className="small">
                Duration: {selectedImage.duration ? `${Math.floor(selectedImage.duration)}s` : 'Unknown'}
              </div>
            </>
          )}
          {isImage && (
            <div className="small">{selectedImage.width}x{selectedImage.height}</div>
          )}
        </div>
      </div>

      {/* Video: Frame extraction controls */}
      {isVideo && !hasFrames && (
        <div className="section">
          <h3>Frame Extraction</h3>
          <div className="control-group">
            <label className="control-row">
              <span>Interval</span>
              <select value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
                <option value={0.04}>Every frame (24fps)</option>
                <option value={1}>Every second</option>
                <option value={2}>Every 2 seconds</option>
                <option value={5}>Every 5 seconds</option>
                <option value={10}>Every 10 seconds</option>
              </select>
            </label>
            <label className="control-row">
              <span>Max frames</span>
              <input
                type="range"
                min={10}
                max={2000}
                step={10}
                value={maxFrames}
                onChange={(e) => setMaxFrames(Number(e.target.value))}
              />
              <span style={{ minWidth: 36, textAlign: 'right', fontSize: 12 }}>{maxFrames}</span>
            </label>
            <label className="control-row">
              <span>Quality</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}>
                <option value="low">Low (JPEG 60%)</option>
                <option value="medium">Medium (JPEG 85%)</option>
                <option value="high">High (PNG)</option>
              </select>
            </label>
            <button onClick={() => onExtractFrames(interval, maxFrames, quality)} disabled={!!extractionProgress}>
              {extractionProgress ? 'Extracting...' : 'Extract Frames'}
            </button>
            {extractionProgress && (
              <div className="tokenise-progress">
                <div className="tokenise-progress-bar">
                  <div
                    className="tokenise-progress-fill"
                    style={{ width: `${Math.round((extractionProgress.completed / extractionProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="small">{extractionProgress.stage} ({extractionProgress.completed}/{extractionProgress.total})</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video: Post-extraction controls */}
      {isVideo && hasFrames && (
        <div className="section">
          <h3>Frames</h3>
          <div className="control-group">
            <div className="small">{extractedFrames.length} frames extracted</div>
            <div className="small">{selectedPieceCount} selected</div>
            <button className="ghost" onClick={onClearFrames}>Clear Frames</button>
          </div>
        </div>
      )}

      {/* Audio: Segments info */}
      {isAudio && hasSegments && (
        <div className="section">
          <h3>Segments</h3>
          <div className="control-group">
            <div className="small">{audioSegments.length} segments</div>
            <div className="small">{selectedPieceCount} selected</div>
          </div>
        </div>
      )}

      {/* Token path */}
      <div className="section">
        <h3>Token Path</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Root</span>
            <input
              type="text"
              value={stampPath}
              onChange={(e) => onStampPathChange(e.target.value)}
              placeholder="$MINT/VIDEO-01"
            />
          </label>
          <div className="small" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {isVideo && `${stampPath}/FRAME-{NNN}`}
            {isAudio && `${stampPath}/SEGMENT-{NNN}`}
            {isImage && stampPath}
          </div>
        </div>
      </div>

      {/* Stamp / Mint */}
      <div className="section">
        <h3>Actions</h3>
        <div className="control-group">
          <button
            onClick={onStampPieces}
            disabled={isStamping || totalPieces === 0}
          >
            {isStamping ? 'Stamping...' : `Hash & Stamp${totalPieces > 0 ? ` (${selectedPieceCount > 0 ? selectedPieceCount : totalPieces})` : ''}`}
          </button>
          <button
            className="secondary"
            onClick={onMintPieces}
            disabled={isMinting || totalPieces === 0}
          >
            {isMinting ? 'Minting...' : `Mint Tokens${totalPieces > 0 ? ` (${selectedPieceCount > 0 ? selectedPieceCount : totalPieces})` : ''}`}
          </button>
          {mintingProgress && (
            <div className="tokenise-progress">
              <div className="tokenise-progress-bar">
                <div
                  className="tokenise-progress-fill"
                  style={{ width: `${Math.round((mintingProgress.completed / mintingProgress.total) * 100)}%` }}
                />
              </div>
              <span className="small">{mintingProgress.completed}/{mintingProgress.total}</span>
            </div>
          )}
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
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
