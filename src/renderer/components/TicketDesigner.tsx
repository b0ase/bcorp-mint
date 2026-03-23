import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ImageItem, LogoAsset } from '../lib/types';
import { loadImage } from '../lib/image-utils';

// ── Ticket Templates ────────────────────────────────────────────────
interface TicketTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  bgColor: string;
  accent: string;
  style: 'concert' | 'vip' | 'festival' | 'membership' | 'voucher' | 'minimal';
}

const TEMPLATES: TicketTemplate[] = [
  { id: 'concert', name: 'Concert', width: 1000, height: 400, bgColor: '#0a0a0a', accent: '#c9a84c', style: 'concert' },
  { id: 'vip', name: 'VIP Pass', width: 500, height: 800, bgColor: '#0a0a0a', accent: '#ffd700', style: 'vip' },
  { id: 'festival', name: 'Festival', width: 1000, height: 400, bgColor: '#1a0020', accent: '#ff00ff', style: 'festival' },
  { id: 'membership', name: 'Membership', width: 850, height: 540, bgColor: '#0a0a0a', accent: '#00e5ff', style: 'membership' },
  { id: 'voucher', name: 'Voucher', width: 900, height: 450, bgColor: '#0a1a0a', accent: '#00ff41', style: 'voucher' },
  { id: 'minimal', name: 'Minimal', width: 800, height: 350, bgColor: '#000000', accent: '#ffffff', style: 'minimal' },
];

type Props = {
  image: ImageItem | null;
  logos: LogoAsset[];
};

export default function TicketDesigner({ image, logos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [showLogo, setShowLogo] = useState(true);

  // Fields
  const [eventName, setEventName] = useState('THE BITCOIN CORPORATION');
  const [subtitle, setSubtitle] = useState('Annual Conference 2026');
  const [date, setDate] = useState('2026-04-15');
  const [time, setTime] = useState('21:00');
  const [venue, setVenue] = useState('Convention Centre');
  const [tier, setTier] = useState('GENERAL ADMISSION');
  const [seat, setSeat] = useState('');
  const [price, setPrice] = useState('0.1 BSV');
  const [holder, setHolder] = useState('');
  const [ticketId, setTicketId] = useState(`TK-${Date.now().toString(36).toUpperCase()}`);
  const [terms, setTerms] = useState('Non-transferable. Valid for one entry only.');

  // Minting
  const [txid, setTxid] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);

  useEffect(() => {
    if (!image?.url) { setLoadedImage(null); return; }
    loadImage(image.url).then(setLoadedImage).catch(() => setLoadedImage(null));
  }, [image?.url]);

  useEffect(() => {
    if (logos.length === 0) return;
    loadImage(logos[0].src).then(setLogoImg).catch(() => {});
  }, [logos]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = template.width;
    const h = template.height;
    canvas.width = w;
    canvas.height = h;
    const accent = template.accent;

    // Background
    ctx.fillStyle = template.bgColor;
    ctx.fillRect(0, 0, w, h);

    // Background image
    if (loadedImage) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      const iw = loadedImage.naturalWidth, ih = loadedImage.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      ctx.drawImage(loadedImage, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale);
      ctx.restore();
      // Darken overlay
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `${template.bgColor}ee`);
      grad.addColorStop(0.4, `${template.bgColor}88`);
      grad.addColorStop(1, `${template.bgColor}cc`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Stub line (perforation)
    const stubX = w * 0.75;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(stubX, 0); ctx.lineTo(stubX, h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Left side — event info
    const lx = w * 0.06;
    ctx.textBaseline = 'middle';

    // Event name
    ctx.font = `900 ${h * 0.15}px Impact, Arial Black, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    const lines = eventName.toUpperCase().split('\n');
    const lineH = h * 0.17;
    lines.forEach((line, i) => {
      ctx.fillText(line, lx, h * 0.25 + i * lineH);
    });

    // Subtitle
    ctx.font = `400 ${h * 0.06}px Helvetica Neue, Arial, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(subtitle, lx, h * 0.25 + lines.length * lineH + h * 0.02);

    // Date + time + venue
    ctx.font = `600 ${h * 0.055}px Helvetica Neue, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const dateStr = date ? new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
    ctx.fillText(`${dateStr}${time ? '  ' + time : ''}`, lx, h * 0.72);
    ctx.fillText(venue, lx, h * 0.82);

    // Tier
    ctx.font = `700 ${h * 0.05}px Helvetica Neue, Arial, sans-serif`;
    ctx.fillStyle = accent;
    (ctx as any).letterSpacing = '4px';
    ctx.fillText(tier.toUpperCase(), lx, h * 0.92);
    (ctx as any).letterSpacing = '0px';

    // Right stub — ticket ID, price, seat
    const rx = stubX + (w - stubX) / 2;
    ctx.textAlign = 'center';

    ctx.font = `900 ${h * 0.12}px Impact, Arial Black, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(price, rx, h * 0.25);

    if (seat) {
      ctx.font = `700 ${h * 0.07}px Helvetica Neue, Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(seat, rx, h * 0.42);
    }

    ctx.font = `500 ${h * 0.04}px IBM Plex Mono, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(ticketId, rx, h * 0.58);

    if (holder) {
      ctx.font = `500 ${h * 0.04}px Helvetica Neue, Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(holder, rx, h * 0.7);
    }

    // QR placeholder
    const qrSize = (w - stubX) * 0.45;
    const qrX = rx - qrSize / 2;
    const qrY = h * 0.75 - qrSize / 2;
    ctx.fillStyle = '#000000';
    ctx.fillRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
    // Pseudo QR pattern
    const cells = 11;
    const cellSize = qrSize / cells;
    let seed = 0;
    for (let i = 0; i < ticketId.length; i++) seed = ((seed << 5) - seed + ticketId.charCodeAt(i)) | 0;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };
    ctx.fillStyle = accent;
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if ((r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3)) {
        ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize);
      } else if (rng() > 0.5) {
        ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize);
      }
    }

    // Border
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Terms (tiny)
    ctx.textAlign = 'left';
    ctx.font = `400 ${h * 0.025}px Helvetica Neue, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(terms, lx, h * 0.98);

    // Logo
    if (showLogo && logoImg) {
      const ls = 0.08;
      const lw = logoImg.naturalWidth * ls;
      const lh = logoImg.naturalHeight * ls;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(logoImg, w * 0.06, h * 0.04, lw, lh);
      ctx.restore();
    }

    // TXID watermark if minted
    if (txid) {
      ctx.save();
      ctx.font = `500 ${h * 0.03}px IBM Plex Mono, monospace`;
      ctx.fillStyle = 'rgba(0,255,65,0.3)';
      ctx.textAlign = 'center';
      ctx.fillText(`VERIFIED: ${txid.slice(0, 24)}...`, w / 2, h * 0.02 + h * 0.03);
      ctx.restore();
    }
  }, [template, eventName, subtitle, date, time, venue, tier, seat, price, holder, ticketId, terms, loadedImage, logoImg, showLogo, txid]);

  useEffect(() => { draw(); }, [draw]);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    await window.mint.saveFile(dataUrl, undefined, `ticket-${ticketId}.png`);
  };

  const handleHashMint = async () => {
    setIsMinting(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('No canvas');
      const dataUrl = canvas.toDataURL('image/png');
      const filePath = await window.mint.exportMintPng({ dataUrl, defaultName: `ticket-${ticketId}` });
      if (!filePath) throw new Error('Save failed');
      const { hash } = await window.mint.hashFile(filePath);
      const { txid: tid } = await window.mint.inscribeStamp({
        path: `$TICKET/${ticketId}`,
        hash,
        timestamp: new Date().toISOString(),
      });
      setTxid(tid);
    } catch (err) {
      console.error('Ticket mint failed:', err);
    }
    setIsMinting(false);
  };

  const regenerateId = () => setTicketId(`TK-${Date.now().toString(36).toUpperCase()}`);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 8, padding: 8, overflow: 'hidden' }}>
      {/* Preview */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: 8, overflow: 'hidden', minHeight: 0, padding: 12 }}>
        <canvas ref={canvasRef} style={{
          maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto',
          display: 'block', borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }} />
      </div>

      {/* Controls */}
      <div style={{ width: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {/* Template */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Template</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setTemplate(t)} style={{
                padding: '5px 0', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                fontSize: 9, fontWeight: 600,
                background: template.id === t.id ? t.accent : 'var(--panel-2)',
                borderColor: template.id === t.id ? t.accent : 'rgba(255,255,255,0.06)',
                color: template.id === t.id ? '#000' : 'var(--muted)',
              }}>{t.name}</button>
            ))}
          </div>
        </div>

        {/* Event fields */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Event</div>
          {[
            { label: 'Event', value: eventName, set: setEventName, multi: true },
            { label: 'Subtitle', value: subtitle, set: setSubtitle },
            { label: 'Venue', value: venue, set: setVenue },
            { label: 'Tier', value: tier, set: setTier },
            { label: 'Seat', value: seat, set: setSeat, placeholder: 'Optional' },
            { label: 'Price', value: price, set: setPrice },
            { label: 'Holder', value: holder, set: setHolder, placeholder: 'Optional' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 9, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>{f.label}</label>
              {(f as any).multi ? (
                <textarea value={f.value} onChange={e => f.set(e.target.value)} rows={2}
                  style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 12, fontWeight: 700, resize: 'none', fontFamily: 'inherit' }} />
              ) : (
                <input type="text" value={f.value} onChange={e => f.set(e.target.value)} placeholder={(f as any).placeholder || ''}
                  style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 11 }} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: 10 }} />
            </div>
          </div>
        </div>

        {/* Ticket ID */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 6 }}>Ticket ID</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="text" value={ticketId} onChange={e => setTicketId(e.target.value)}
              style={{ flex: 1, background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 10, fontFamily: 'monospace' }} />
            <button onClick={regenerateId} style={{ padding: '4px 8px', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: 'var(--muted)', fontSize: 10, cursor: 'pointer' }}>New</button>
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{terms}</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleExport} style={{
            flex: 1, padding: '8px 0', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>Export PNG</button>
          <button onClick={handleHashMint} disabled={isMinting} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, color: '#fff',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            background: isMinting ? 'var(--panel-2)' : `linear-gradient(135deg, ${template.accent}, ${template.accent}88)`,
            cursor: isMinting ? 'wait' : 'pointer',
          }}>{isMinting ? 'Minting...' : 'Hash & Mint'}</button>
        </div>

        {txid && (
          <div style={{ background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: 6, padding: 8 }}>
            <div style={{ fontSize: 9, color: '#00ff41', fontWeight: 700, marginBottom: 4 }}>TICKET MINTED</div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)', wordBreak: 'break-all' }}>TXID: {txid}</div>
          </div>
        )}
      </div>
    </div>
  );
}
