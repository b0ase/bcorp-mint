import React, { useCallback, useState } from 'react';
import type { TextOverlay } from '../lib/types';
import { coverTemplates } from '../lib/cover-templates';

type CoversGalleryProps = {
  onClose: () => void;
  onSelectCover: (filePath: string) => void;
  onApplyTemplate: (overlays: TextOverlay[]) => void;
};

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp']);

export default function CoversGallery({ onClose, onSelectCover, onApplyTemplate }: CoversGalleryProps) {
  const [tab, setTab] = useState<'gallery' | 'templates'>('gallery');
  const [coverPaths, setCoverPaths] = useState<string[]>([]);
  const [coverThumbs, setCoverThumbs] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // Template inputs
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [issueNum, setIssueNum] = useState('');

  const handleLoadFolder = useCallback(async () => {
    const result = await window.mint.selectFolder();
    if (!result) return;

    const imageFiles = result.files.filter((f: string) => {
      const ext = '.' + f.split('.').pop()?.toLowerCase();
      return IMAGE_EXT.has(ext);
    });

    setCoverPaths(imageFiles);
    setLoading(true);

    // Load thumbnails
    const thumbMap = new Map<string, string>();
    for (const filePath of imageFiles) {
      try {
        const url = await window.mint.fileUrl(filePath);
        thumbMap.set(filePath, url);
      } catch {
        // skip failed loads
      }
    }
    setCoverThumbs(thumbMap);
    setLoading(false);
  }, []);

  const handleSelectCover = useCallback((filePath: string) => {
    onSelectCover(filePath);
    onClose();
  }, [onSelectCover, onClose]);

  const handleApplyTemplate = useCallback((templateId: string) => {
    const template = coverTemplates.find((t) => t.id === templateId);
    if (!template) return;
    const overlays = template.factory(
      title || undefined,
      subtitle || undefined,
      issueNum || undefined
    );
    onApplyTemplate(overlays);
    onClose();
  }, [title, subtitle, issueNum, onApplyTemplate, onClose]);

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Covers</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="turn-toggle">
              <button
                className={`turn-toggle-btn ${tab === 'gallery' ? 'active' : ''}`}
                onClick={() => setTab('gallery')}
              >
                Gallery
              </button>
              <button
                className={`turn-toggle-btn ${tab === 'templates' ? 'active' : ''}`}
                onClick={() => setTab('templates')}
              >
                Templates
              </button>
            </div>
            <button className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', maxHeight: '65vh' }}>
          {tab === 'gallery' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <button className="secondary" onClick={handleLoadFolder}>
                  Load Covers Folder
                </button>
              </div>

              {loading && (
                <div className="small" style={{ textAlign: 'center', padding: 24 }}>
                  Loading thumbnails...
                </div>
              )}

              {!loading && coverPaths.length === 0 && (
                <div className="small" style={{ textAlign: 'center', padding: 40 }}>
                  Select a folder to browse cover images.
                </div>
              )}

              {coverPaths.length > 0 && (
                <div className="covers-gallery-grid">
                  {coverPaths.map((filePath) => {
                    const thumb = coverThumbs.get(filePath);
                    const name = filePath.split('/').pop() || filePath;
                    return (
                      <div
                        key={filePath}
                        className="covers-gallery-thumb"
                        onClick={() => handleSelectCover(filePath)}
                        title={name}
                      >
                        {thumb ? (
                          <img src={thumb} alt={name} />
                        ) : (
                          <div className="covers-gallery-placeholder">Loading...</div>
                        )}
                        <div className="covers-gallery-label">{name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="control-group" style={{ marginBottom: 16 }}>
                <label className="control-row">
                  <span>Title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Cover title"
                  />
                </label>
                <label className="control-row">
                  <span>Subtitle</span>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Subtitle text"
                  />
                </label>
                <label className="control-row">
                  <span>Issue #</span>
                  <input
                    type="text"
                    value={issueNum}
                    onChange={(e) => setIssueNum(e.target.value)}
                    placeholder="#001"
                  />
                </label>
              </div>

              <div className="mint-template-grid">
                {coverTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="mint-template-card"
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    <div className="mint-template-name">{template.name}</div>
                    <div className="mint-template-desc">{template.description}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
