import React, { useState, useEffect } from 'react';
import type { MetaNetNodeUI } from '@shared/lib/types';

type Props = {
  node: MetaNetNodeUI | null;
};

export default function FilePreviewCanvas({ node }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    if (!node || node.type === 'folder') {
      setDataUrl(null);
      setTextContent(null);
      return;
    }

    const mime = node.mimeType || '';

    if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
      window.mint.fileUrl(node.localPath).then(setDataUrl).catch(() => setDataUrl(null));
      setTextContent(null);
    } else if (mime.startsWith('text/') || mime === 'application/json') {
      // Read text files for preview via file-url then decode
      window.mint.fileUrl(node.localPath).then((url) => {
        // Decode base64 data URL to text
        const match = url.match(/^data:(.+);base64,(.*)$/);
        if (match) {
          try {
            setTextContent(atob(match[2]));
          } catch {
            setTextContent('[Unable to decode]');
          }
        }
      }).catch(() => setTextContent(null));
      setDataUrl(null);
    } else {
      setDataUrl(null);
      setTextContent(null);
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div className="file-preview-empty">
        <span>Select a file to preview</span>
      </div>
    );
  }

  if (node.type === 'folder') {
    return (
      <div className="file-preview-folder">
        <div className="file-preview-folder-icon">{'\uD83D\uDCC1'}</div>
        <h3>{node.name}</h3>
        <p className="muted">{node.children.length} items</p>
        <div className="file-preview-meta">
          <div className="meta-row">
            <span className="meta-label">MetaNet Path</span>
            <span className="meta-value">{node.metanetPath}</span>
          </div>
          {node.txid && (
            <div className="meta-row">
              <span className="meta-label">TxID</span>
              <span className="meta-value mono">{node.txid}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const mime = node.mimeType || '';

  return (
    <div className="file-preview-canvas">
      <div className="file-preview-content">
        {mime.startsWith('image/') && dataUrl && (
          <img src={dataUrl} alt={node.name} className="file-preview-image" />
        )}
        {mime.startsWith('video/') && dataUrl && (
          <video src={dataUrl} controls className="file-preview-video" />
        )}
        {mime.startsWith('audio/') && dataUrl && (
          <audio src={dataUrl} controls className="file-preview-audio" />
        )}
        {textContent !== null && (
          <pre className="file-preview-text">{textContent.slice(0, 10000)}</pre>
        )}
        {!dataUrl && textContent === null && (
          <div className="file-preview-binary">
            <span className="file-preview-binary-icon">{'\uD83D\uDCC4'}</span>
            <p>{node.name}</p>
            <p className="muted">{(node.size / 1024).toFixed(1)} KB</p>
          </div>
        )}
      </div>

      <div className="file-preview-meta">
        <div className="meta-row">
          <span className="meta-label">Path</span>
          <span className="meta-value">{node.metanetPath}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Size</span>
          <span className="meta-value">{(node.size / 1024).toFixed(1)} KB</span>
        </div>
        {node.hash && (
          <div className="meta-row">
            <span className="meta-label">SHA-256</span>
            <span className="meta-value mono">{node.hash}</span>
          </div>
        )}
        {node.txid && (
          <div className="meta-row">
            <span className="meta-label">TxID</span>
            <span className="meta-value mono">{node.txid}</span>
          </div>
        )}
        {node.derivedAddress && (
          <div className="meta-row">
            <span className="meta-label">Address</span>
            <span className="meta-value mono">{node.derivedAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}
