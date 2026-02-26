import React from 'react';
import type { ImageItem, Spread } from '@shared/lib/types';

type AnimateProgress = {
  stage: string;
  percent: number;
  elapsed: number;
  detail?: string;
};

type PageStripProps = {
  spreads: Spread[];
  allImages: ImageItem[];
  activeIndex: number;
  enabledIds: Set<string> | null;
  onPageClick: (index: number) => void;
  onToggleImage: (id: string) => void;
  comfyConnected: boolean;
  comfyModels: string[];
  selectedModel: string | null;
  onModelChange: (model: string) => void;
  isAnimating: boolean;
  animateProgress: AnimateProgress | null;
  onAnimate: () => void;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

export default function PageStrip({ spreads, allImages, activeIndex, enabledIds, onPageClick, onToggleImage, comfyConnected, comfyModels, selectedModel, onModelChange, isAnimating, animateProgress, onAnimate }: PageStripProps) {
  const notInIssue = enabledIds ? allImages.filter((img) => !enabledIds.has(img.id)) : [];

  return (
    <div className="page-strip">
      {spreads.map((spread, i) => {
        const images =
          spread.type === 'portrait-pair'
            ? [spread.left, spread.right]
            : [spread.image];

        const anyInIssue = !enabledIds || images.some((img) => enabledIds.has(img.id));

        return (
          <div
            key={i}
            className={`page-thumb ${i === activeIndex ? 'active' : ''} ${enabledIds && !anyInIssue ? 'disabled' : ''}`}
            onClick={() => onPageClick(i)}
          >
            <div className="page-thumb-images">
              {images.map((img) => (
                <img key={img.id} src={img.url} alt={img.name} />
              ))}
            </div>
            <span className="page-thumb-label">
              {enabledIds && anyInIssue ? `\u2713 ${i + 1}` : i + 1}
            </span>
          </div>
        );
      })}

      {notInIssue.length > 0 && notInIssue.length < allImages.length && (
        <>
          <div className="page-strip-divider" />
          <span className="page-thumb-label" style={{ alignSelf: 'center', padding: '0 4px' }}>
            {notInIssue.length} not in issue
          </span>
        </>
      )}

      <div className="page-strip-spacer" />

      {isAnimating && animateProgress && (
        <div className="animate-progress">
          <div className="animate-progress-bar">
            <div
              className="animate-progress-fill"
              style={{ width: `${animateProgress.percent}%` }}
            />
          </div>
          <span className="animate-progress-text">
            {animateProgress.stage}
            {' '}
            {formatElapsed(animateProgress.elapsed)}
            {animateProgress.detail ? ` \u00b7 ${animateProgress.detail}` : ''}
          </span>
        </div>
      )}

      {comfyConnected && comfyModels.length > 0 && (
        <select
          className="model-select"
          value={selectedModel ?? ''}
          onChange={(e) => onModelChange(e.target.value)}
          title="Select AI model"
        >
          {comfyModels.map((m) => (
            <option key={m} value={m}>{m.replace(/\.(safetensors|ckpt|pt)$/, '')}</option>
          ))}
        </select>
      )}

      <button
        className={`animate-btn ${comfyConnected ? 'connected' : ''}`}
        disabled={!comfyConnected || isAnimating || !selectedModel}
        onClick={onAnimate}
        title={
          !comfyConnected
            ? 'Start ComfyUI on localhost:8188 to enable'
            : !selectedModel
              ? 'No video models found in ComfyUI'
              : isAnimating
                ? 'Generating video...'
                : 'Animate selected image with ComfyUI'
        }
      >
        {isAnimating ? 'Animating\u2026' : comfyConnected ? 'Animate' : 'Animate (no ComfyUI)'}
      </button>
    </div>
  );
}
