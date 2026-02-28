'use client';

import React, { useMemo, useState } from 'react';
import type { ActiveIssue, AppMode, ImageItem } from '@shared/lib/types';
import type { QRContentType } from '@shared/lib/qr-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StampPreset = {
  label: string;
  icon: string;
  watermarkText: string;
  borderStampText: string;
  watermarkOpacity: number;
  watermarkPosition: 'center' | 'diagonal' | 'bottom-right';
};

type InfoPreset = {
  label: string;
  icon: string;
  description: string;
};

type QRExample = {
  label: string;
  icon: string;
  type: QRContentType;
  content: Record<string, string>;
};

type BundledNote = {
  name: string;
  src: string;
};

export type LeftPanelProps = {
  mode: AppMode;
  images: ImageItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleImage?: (id: string) => void;
  currentIssue: ActiveIssue | null;
  isImageInIssue: (id: string) => boolean;
  pairMap: Map<string, string>;
  // Tab-specific callbacks
  qr: { loadPreset: (type: QRContentType, content: Record<string, string>) => void };
  mint: { addImageLayer: (src: string, name: string) => void };
  onLoadStampPreset?: (preset: StampPreset) => void;
  sendToMode: (targetMode: AppMode, item: ImageItem) => void;
};

// ---------------------------------------------------------------------------
// Example Data
// ---------------------------------------------------------------------------

const HEADINGS: Record<AppMode, string> = {
  stamp: 'Images',
  currency: 'Assets',
  stocks: 'Certificates',
  bonds: 'Bonds',
  tokenise: 'Media',
  music: 'Scores',
  magazine: 'Pages',
  qr: 'QR Codes',
};

const QR_EXAMPLES: QRExample[] = [
  { label: 'Website', icon: '', type: 'url', content: { url: 'https://bcorpmint.com' } },
  { label: 'Bitcoin Address', icon: '', type: 'wallet', content: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' } },
  { label: 'BSV-20 Token', icon: '', type: 'token', content: { symbol: 'BCORP', supply: '100000000000', protocol: 'BSV-20', address: '' } },
  { label: 'Contact Card', icon: '', type: 'vcard', content: { name: 'Satoshi Nakamoto', email: 'satoshi@bitcoin.org', phone: '+1-555-0100', org: 'Bitcoin Corporation' } },
  { label: 'WiFi Network', icon: '', type: 'wifi', content: { ssid: 'bCorp-Guest', password: 'goldstandard', encryption: 'WPA' } },
  { label: 'Email', icon: '', type: 'email', content: { address: 'mint@bcorp.com', subject: 'PoW Note Enquiry', body: 'I am interested in acquiring a PoW Note.' } },
  { label: 'Plain Text', icon: '', type: 'text', content: { text: 'This note is backed by Proof of Work. SHA-256 verified.' } },
  { label: '$401 Identity', icon: '', type: 'url', content: { url: 'https://path401.com/verify/satoshi' } },
  { label: 'Mint Receipt', icon: '', type: 'text', content: { text: 'STAMP|$BCORP/SERIES-01/NOTE-001|sha256:e3b0c44298fc1c149afbf4c8996fb924|2026-02-27T00:00:00Z' } },
  { label: 'GitHub Repo', icon: '', type: 'url', content: { url: 'https://github.com/b0ase/bcorp-mint' } },
  { label: '$402 Payment', icon: '', type: 'url', content: { url: 'https://path402.com/pay/0.01' } },
  { label: 'PoW Note #001', icon: '', type: 'text', content: { text: 'POW-NOTE|001|DIFFICULTY:2^32|REWARD:0.001BSV|HASH:0000000000000003fa2e6...' } },
];

const BUNDLED_NOTES: BundledNote[] = [
  'image', 'image-1', 'image-2', 'image-3', 'image-4', 'image-5',
  'image-6', 'image-7', 'image-8', 'image-9', 'image-10', 'image-11',
].map((name) => ({
  name: name.replace('image', 'Note'),
  src: `/bcorp notes landscape/${name}.jpg`,
}));

const STAMP_EXAMPLES: StampPreset[] = [
  { label: 'Certificate of Authenticity', icon: '', watermarkText: 'AUTHENTIC', borderStampText: 'CERTIFIED ORIGINAL \u2014 SHA-256 VERIFIED', watermarkOpacity: 0.15, watermarkPosition: 'diagonal' },
  { label: 'Notary Seal', icon: '', watermarkText: 'NOTARISED', borderStampText: 'NOTARY PUBLIC \u2014 BLOCKCHAIN VERIFIED', watermarkOpacity: 0.12, watermarkPosition: 'center' },
  { label: 'Copyright Notice', icon: '', watermarkText: '\u00A9 ALL RIGHTS RESERVED', borderStampText: 'COPYRIGHT PROTECTED \u2014 IMMUTABLE RECORD', watermarkOpacity: 0.1, watermarkPosition: 'diagonal' },
  { label: 'Patent Filing', icon: '', watermarkText: 'PATENT PENDING', borderStampText: 'PATENT APPLICATION \u2014 TIMESTAMPED ON-CHAIN', watermarkOpacity: 0.12, watermarkPosition: 'center' },
  { label: 'Digital Signature', icon: '', watermarkText: 'SIGNED', borderStampText: 'DIGITALLY SIGNED \u2014 CRYPTOGRAPHIC PROOF', watermarkOpacity: 0.15, watermarkPosition: 'bottom-right' },
  { label: 'Time Capsule', icon: '', watermarkText: 'SEALED', borderStampText: 'TIME CAPSULE \u2014 SEALED ON-CHAIN', watermarkOpacity: 0.1, watermarkPosition: 'center' },
  { label: 'Chain of Custody', icon: '', watermarkText: 'CUSTODY LOG', borderStampText: 'CHAIN OF CUSTODY \u2014 TAMPER-EVIDENT', watermarkOpacity: 0.12, watermarkPosition: 'diagonal' },
  { label: 'Identity Proof', icon: '', watermarkText: 'VERIFIED', borderStampText: 'IDENTITY VERIFICATION \u2014 $401 PROTOCOL', watermarkOpacity: 0.15, watermarkPosition: 'center' },
  { label: 'License Agreement', icon: '', watermarkText: 'LICENSED', borderStampText: 'LICENSE AGREEMENT \u2014 TERMS ON-CHAIN', watermarkOpacity: 0.1, watermarkPosition: 'diagonal' },
  { label: 'Limited Edition', icon: '', watermarkText: 'LIMITED', borderStampText: 'LIMITED EDITION \u2014 NUMBERED SERIES', watermarkOpacity: 0.15, watermarkPosition: 'center' },
  { label: 'Archive Record', icon: '', watermarkText: 'ARCHIVED', borderStampText: 'PERMANENT ARCHIVE \u2014 IMMUTABLE STORAGE', watermarkOpacity: 0.1, watermarkPosition: 'diagonal' },
  { label: 'Proof of Existence', icon: '', watermarkText: 'EXISTS', borderStampText: 'PROOF OF EXISTENCE \u2014 HASH ANCHORED', watermarkOpacity: 0.12, watermarkPosition: 'center' },
];

const TOKENISE_EXAMPLES: InfoPreset[] = [
  { label: 'Video Frames', icon: '', description: 'Extract individual frames from video as tokenisable pieces' },
  { label: 'Audio Segments', icon: '', description: 'Split audio tracks into segments for individual minting' },
  { label: 'Photo Collection', icon: '', description: 'Batch tokenise a series of photographs' },
  { label: 'NFT Series', icon: '', description: 'Create a numbered series of unique tokens' },
  { label: 'Album Tracks', icon: '', description: 'Tokenise each track of a music album individually' },
  { label: 'Comic Pages', icon: '', description: 'Mint each page of a comic as a collectible token' },
  { label: 'Document Archive', icon: '', description: 'Stamp and tokenise an archive of documents' },
  { label: 'AI Generations', icon: '', description: 'Tokenise AI-generated artwork with provenance stamps' },
];

const MUSIC_EXAMPLES: InfoPreset[] = [
  { label: 'Piano Sonata', icon: '', description: 'Classical piano composition in 4/4 time' },
  { label: 'Guitar Tab', icon: '', description: 'Tablature notation for guitar arrangements' },
  { label: 'Drum Pattern', icon: '', description: 'Percussive patterns and beats notation' },
  { label: 'Bass Line', icon: '', description: 'Walking bass lines and bass clef notation' },
  { label: 'Vocal Melody', icon: '', description: 'Vocal line with lyric annotations' },
  { label: 'String Quartet', icon: '', description: 'Four-part string arrangement score' },
  { label: 'Jazz Improv', icon: '', description: 'Jazz chord charts with improvisation guides' },
  { label: 'Electronic Beat', icon: '', description: 'Electronic music pattern with synth notation' },
];

const MAGAZINE_EXAMPLES: InfoPreset[] = [
  { label: 'Front Cover', icon: '', description: 'Hero image, masthead, and cover lines' },
  { label: 'Back Cover', icon: '', description: 'Sponsor ads, barcode, and issue info' },
  { label: 'Contents Page', icon: '', description: 'Table of contents with page numbers' },
  { label: 'Editorial', icon: '', description: 'Editor\'s letter and column layout' },
  { label: 'Photo Spread', icon: '', description: 'Full-bleed photography across pages' },
  { label: 'Interview', icon: '', description: 'Q&A layout with pull quotes' },
  { label: 'Advert', icon: '', description: 'Full or half-page advertisement layout' },
  { label: 'Credits', icon: '', description: 'Contributors, credits, and colophon' },
];

const STOCKS_EXAMPLES: InfoPreset[] = [
  { label: 'Common Stock', icon: '', description: 'Standard voting shares with proportional ownership' },
  { label: 'Preferred Stock', icon: '', description: 'Priority dividends and liquidation preference' },
  { label: 'Class A Shares', icon: '', description: 'Enhanced voting rights, typically founders' },
  { label: 'Class B Shares', icon: '', description: 'Reduced voting, widely distributed shares' },
  { label: 'Convertible Preferred', icon: '', description: 'Preferred shares convertible to common stock' },
  { label: 'Restricted Stock', icon: '', description: 'Vesting schedule, typically employee grants' },
  { label: 'Treasury Stock', icon: '', description: 'Repurchased shares held by the company' },
  { label: 'Founders Shares', icon: '', description: 'Special class for founding team members' },
];

const BONDS_EXAMPLES: InfoPreset[] = [
  { label: 'Government Bond', icon: '', description: 'Sovereign debt backed by government credit' },
  { label: 'Corporate Bond', icon: '', description: 'Company-issued debt with fixed coupon payments' },
  { label: 'Municipal Bond', icon: '', description: 'Local government bonds, often tax-exempt' },
  { label: 'Zero-Coupon Bond', icon: '', description: 'Sold at discount, no periodic interest payments' },
  { label: 'Convertible Bond', icon: '', description: 'Debt convertible to equity at holder option' },
  { label: 'Bearer Bond', icon: '', description: 'Unregistered bond, payable to holder' },
  { label: 'Savings Bond', icon: '', description: 'Low-risk government savings instrument' },
  { label: 'Green Bond', icon: '', description: 'Proceeds fund environmental/climate projects' },
];

// ---------------------------------------------------------------------------
// Sub-Views
// ---------------------------------------------------------------------------

function ExamplesView({
  mode,
  qr,
  mint,
  onLoadStampPreset,
}: {
  mode: AppMode;
  qr: LeftPanelProps['qr'];
  mint: LeftPanelProps['mint'];
  onLoadStampPreset?: (preset: StampPreset) => void;
}) {
  switch (mode) {
    case 'qr':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {QR_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                className="qr-example-btn"
                onClick={() => qr.loadPreset(ex.type, ex.content)}
              >
                <span className="qr-example-icon">{ex.icon}</span>
                <span className="qr-example-label">{ex.label}</span>
              </button>
            ))}
          </div>
        </div>
      );

    case 'currency':
      return (
        <div className="lp-examples">
          <div className="small" style={{ color: 'var(--accent-dim)', marginBottom: 6 }}>Note Gallery</div>
          <div className="note-gallery-grid">
            {BUNDLED_NOTES.map((note) => (
              <div
                key={note.name}
                className="note-gallery-thumb"
                onClick={() => mint.addImageLayer(note.src, note.name)}
                title={note.name}
              >
                <img src={note.src} alt={note.name} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'stamp':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {STAMP_EXAMPLES.map((preset) => (
              <button
                key={preset.label}
                className="lp-example-btn"
                onClick={() => onLoadStampPreset?.(preset)}
              >
                <span className="lp-example-icon">{preset.icon}</span>
                <span className="lp-example-label">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      );

    case 'tokenise':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {TOKENISE_EXAMPLES.map((ex) => (
              <div key={ex.label} className="lp-info-card">
                <span className="lp-info-icon">{ex.icon}</span>
                <div className="lp-info-text">
                  <strong>{ex.label}</strong>
                  <span>{ex.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'music':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {MUSIC_EXAMPLES.map((ex) => (
              <div key={ex.label} className="lp-info-card">
                <span className="lp-info-icon">{ex.icon}</span>
                <div className="lp-info-text">
                  <strong>{ex.label}</strong>
                  <span>{ex.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'magazine':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {MAGAZINE_EXAMPLES.map((ex) => (
              <div key={ex.label} className="lp-info-card">
                <span className="lp-info-icon">{ex.icon}</span>
                <div className="lp-info-text">
                  <strong>{ex.label}</strong>
                  <span>{ex.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'stocks':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {STOCKS_EXAMPLES.map((ex) => (
              <div key={ex.label} className="lp-info-card">
                <span className="lp-info-icon">{ex.icon}</span>
                <div className="lp-info-text">
                  <strong>{ex.label}</strong>
                  <span>{ex.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'bonds':
      return (
        <div className="lp-examples">
          <div className="lp-examples-list">
            {BONDS_EXAMPLES.map((ex) => (
              <div key={ex.label} className="lp-info-card">
                <span className="lp-info-icon">{ex.icon}</span>
                <div className="lp-info-text">
                  <strong>{ex.label}</strong>
                  <span>{ex.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

function MediaView({
  mode,
  images,
  selectedId,
  onSelect,
  onToggleImage,
  currentIssue,
  isImageInIssue,
  pairMap,
  mint,
  sendToMode,
}: {
  mode: AppMode;
  images: ImageItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleImage?: (id: string) => void;
  currentIssue: ActiveIssue | null;
  isImageInIssue: (id: string) => boolean;
  pairMap: Map<string, string>;
  mint: LeftPanelProps['mint'];
  sendToMode: (targetMode: AppMode, item: ImageItem) => void;
}) {
  const SEND_TARGETS: Record<AppMode, { label: string; target: AppMode }[]> = {
    stamp: [{ label: 'Tokenise', target: 'tokenise' }],
    currency: [{ label: 'Tokenise', target: 'tokenise' }, { label: 'QR', target: 'qr' }],
    stocks: [{ label: 'Tokenise', target: 'tokenise' }, { label: 'QR', target: 'qr' }],
    bonds: [{ label: 'Tokenise', target: 'tokenise' }, { label: 'QR', target: 'qr' }],
    tokenise: [],
    music: [{ label: 'Tokenise', target: 'tokenise' }],
    magazine: [{ label: 'Tokenise', target: 'tokenise' }],
    qr: [{ label: 'Currency', target: 'currency' }],
  };

  if (images.length === 0) {
    return (
      <div className="image-list">
        <div className="empty-sidebar">
          {mode === 'currency' ? (
            <>
              <div className="empty-sidebar-icon">{'\u2756'}</div>
              <div className="small" style={{ color: 'var(--accent-dim)' }}>Currency Designer</div>
              <div className="small">Import background images, portraits, or textures for your banknote layers.</div>
              <div className="small" style={{ opacity: 0.4, marginTop: 4 }}>Supports JPG, PNG, WebP, TIFF</div>
            </>
          ) : mode === 'stocks' ? (
            <>
              <div className="empty-sidebar-icon">{'\u{1F4C8}'}</div>
              <div className="small" style={{ color: 'var(--accent-dim)' }}>Stock Certificate Designer</div>
              <div className="small">Design share certificates with ornate borders, serial numbers, and security features.</div>
              <div className="small" style={{ opacity: 0.4, marginTop: 4 }}>Common &middot; Preferred &middot; Class A/B</div>
            </>
          ) : mode === 'bonds' ? (
            <>
              <div className="empty-sidebar-icon">{'\u{1F3DB}\uFE0F'}</div>
              <div className="small" style={{ color: 'var(--accent-dim)' }}>Bond Certificate Designer</div>
              <div className="small">Design bond certificates with coupon schedules, maturity dates, and security features.</div>
              <div className="small" style={{ opacity: 0.4, marginTop: 4 }}>Government &middot; Corporate &middot; Municipal</div>
            </>
          ) : mode === 'tokenise' ? (
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
          ) : mode === 'music' ? (
            <>
              <div className="empty-sidebar-icon">{'\u266B'}</div>
              <div className="small" style={{ color: 'var(--accent-dim)' }}>Sheet Music</div>
              <div className="small">Create notation from scratch using the editor, or import reference images.</div>
              <div className="small" style={{ opacity: 0.4, marginTop: 4 }}>Desktop app: full notation editor</div>
            </>
          ) : mode === 'magazine' ? (
            <>
              <div className="empty-sidebar-icon">{'\u{1F4D6}'}</div>
              <div className="small" style={{ color: 'var(--accent-dim)' }}>Magazine Creator</div>
              <div className="small">Add pages for your magazine, zine, or publication. Each page gets framed, branded, and stamped to chain.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <div className="small" style={{ opacity: 0.4 }}>Covers &middot; Spreads &middot; Articles</div>
                <div className="small" style={{ opacity: 0.4 }}>Logo &middot; Watermark &middot; Print &middot; Inscribe</div>
              </div>
            </>
          ) : mode === 'qr' ? (
            <>
              <div className="empty-sidebar-icon">{'\u25A3'}</div>
              <div className="small" style={{ color: 'var(--accent-dim)' }}>QR Code Generator</div>
              <div className="small">Create scannable QR codes for URLs, wallets, tokens, contacts, and more.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <div className="small" style={{ opacity: 0.4 }}>URL &middot; vCard &middot; WiFi &middot; Token</div>
                <div className="small" style={{ opacity: 0.4 }}>Customise &middot; Batch &middot; Export &middot; Inscribe</div>
              </div>
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
      </div>
    );
  }

  const targets = SEND_TARGETS[mode] ?? [];

  return (
    <div className="image-list">
      {images.map((image) => {
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
              isPaired && 'is-paired',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              if (currentIssue && !inIssue) {
                onToggleImage?.(image.id);
              }
              onSelect(image.id);
              if (mode === 'currency' && image.mediaType === 'image') {
                mint.addImageLayer(image.url, image.name);
              }
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
                onClick={(e) => { e.stopPropagation(); onToggleImage?.(image.id); }}
                title={inIssue ? 'Remove from issue' : 'Add to issue'}
              >
                {inIssue ? '\u25C9' : '\u25CB'}
              </button>
            )}
            {targets.length > 0 && (
              <div className="lp-send-btns">
                {targets.map((t) => (
                  <button
                    key={t.target}
                    className="lp-send-btn"
                    title={`Send to ${t.label}`}
                    onClick={(e) => { e.stopPropagation(); sendToMode(t.target, image); }}
                  >
                    &rarr; {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeftPanel
// ---------------------------------------------------------------------------

export default function LeftPanel({
  mode,
  images,
  selectedId,
  onSelect,
  onToggleImage,
  currentIssue,
  isImageInIssue,
  pairMap,
  qr,
  mint,
  onLoadStampPreset,
  sendToMode,
}: LeftPanelProps) {
  const [subView, setSubView] = useState<'examples' | 'media'>('examples');

  const filteredImages = useMemo(
    () => images.filter((img) =>
      img.originMode === mode || img.tags?.includes(mode)
    ),
    [images, mode],
  );

  return (
    <aside className="panel left-panel">
      <h2>{HEADINGS[mode]}</h2>

      <div className="lp-toggle">
        <button
          className={subView === 'examples' ? 'active' : ''}
          onClick={() => setSubView('examples')}
        >
          Examples
        </button>
        <button
          className={subView === 'media' ? 'active' : ''}
          onClick={() => setSubView('media')}
        >
          My Media
        </button>
      </div>

      {subView === 'examples' ? (
        <ExamplesView
          mode={mode}
          qr={qr}
          mint={mint}
          onLoadStampPreset={onLoadStampPreset}
        />
      ) : (
        <MediaView
          mode={mode}
          images={filteredImages}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggleImage={onToggleImage}
          currentIssue={currentIssue}
          isImageInIssue={isImageInIssue}
          pairMap={pairMap}
          mint={mint}
          sendToMode={sendToMode}
        />
      )}
    </aside>
  );
}
