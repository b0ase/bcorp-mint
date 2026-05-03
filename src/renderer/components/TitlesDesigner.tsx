import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ImageItem, LogoAsset } from '../lib/types';
import { loadImage, mediaStreamUrl } from '../lib/image-utils';
import { drawLogo } from '../lib/render';

// ── AtlasCloud API models ──────────────────────────────────────────
const ATLAS_API = 'https://api.atlascloud.ai';

const MODELS = [
  { id: 'seedance-fast', name: 'Seedance Fast', model: 'bytedance/seedance-v1.5-pro/image-to-video-fast', price: 0.018, speed: 'Fastest' },
  { id: 'seedance', name: 'Seedance', model: 'bytedance/seedance-v1.5-pro/text-to-video', price: 0.044, speed: 'Fast' },
  { id: 'wan', name: 'Wan 2.6', model: 'alibaba/wan-2.6/text-to-video', price: 0.07, speed: 'Medium' },
  { id: 'kling-std', name: 'Kling 3.0', model: 'kwaivgi/kling-v3.0-std/text-to-video', price: 0.153, speed: 'Medium' },
  { id: 'kling-pro', name: 'Kling Pro', model: 'kwaivgi/kling-v3.0-pro/text-to-video', price: 0.204, speed: 'Slower' },
] as const;

// ── Title style presets ────────────────────────────────────────────
const TITLE_STYLES = [
  { id: 'prestige', name: 'Prestige', prompt: 'Cinematic title card, elegant financial institution, gold and black, banknote patterns, glitch effects, holographic text floating in dark atmosphere, rain, reflections, ultra high quality' },
  { id: 'corporate', name: 'Corporate', prompt: 'Corporate title card, gold foil lettering on black marble, luxury financial aesthetic, premium feel' },
  { id: 'neon', name: 'Neon Glow', prompt: 'Neon sign title card, glowing pink and red neon tubes forming letters against black background, electric sparks, buzzing light, cinematic' },
  { id: 'kinetic', name: 'Kinetic Type', prompt: 'Kinetic typography title sequence, bold white text slamming into frame, motion blur, dynamic camera movement, black background, film grain' },
  { id: 'elegant', name: 'Elegant', prompt: 'Anime opening title card, cel-shaded Japanese text, cherry blossoms, speed lines, dramatic lighting, vibrant colors, studio quality animation' },
  { id: 'minimal', name: 'Minimal', prompt: 'Minimal elegant title card, clean white text fading in on pure black background, subtle lens flare, cinematic letterboxing, premium feel' },
  { id: 'fire', name: 'Fire', prompt: 'Title card emerging from flames, fire particles, burning edges, ember sparks floating, dark background, intense orange and red glow, cinematic' },
  { id: 'digital', name: 'Digital', prompt: 'VHS glitch art title card, corrupted video signal, RGB shift, scan lines, distorted text, retro CRT monitor aesthetic, datamosh effects' },
] as const;

type GeneratedTitle = {
  id: string;
  jobId: string;
  status: 'pending' | 'generating' | 'done' | 'failed';
  title: string;
  subtitle: string;
  style: string;
  model: string;
  videoUrl?: string;
  prompt: string;
};

type Props = {
  logos: LogoAsset[];
  allImages: ImageItem[];
  onLoadVideo?: (path: string) => void;
};

export default function TitlesDesigner({ logos, allImages }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number>(0);

  // ── State ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('THE BITCOIN CORPORATION');
  const [subtitle, setSubtitle] = useState('Proof of Value');
  const [selectedStyle, setSelectedStyle] = useState<typeof TITLE_STYLES[number]>(TITLE_STYLES[0]);
  const [selectedModel, setSelectedModel] = useState<typeof MODELS[number]>(MODELS[0]);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [apiKey, setApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedTitle[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [loadedTitles, setLoadedTitles] = useState<string[]>([]);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('atlascloud-api-key');
    if (saved) setApiKey(saved);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key) localStorage.setItem('atlascloud-api-key', key);
    else localStorage.removeItem('atlascloud-api-key');
  };

  // Load logo
  useEffect(() => {
    if (logos.length === 0) return;
    loadImage(logos[0].src).then(setLogoImg).catch(() => {});
  }, [logos]);

  // ── Build prompt ───────────────────────────────────────────────────
  const buildPrompt = () => {
    const titleText = title.trim() || 'THE MINT';
    const subText = subtitle.trim();
    return `${selectedStyle.prompt}. The title text reads "${titleText}"${subText ? `, subtitle "${subText}"` : ''}. Bold, high contrast, cinematic motion graphics, 5 seconds, professional title sequence.`;
  };

  // ── Generate via AtlasCloud ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!apiKey) return alert('Enter your AtlasCloud API key');
    if (isGenerating) return;

    setIsGenerating(true);
    const prompt = buildPrompt();
    const id = crypto.randomUUID();

    const newTitle: GeneratedTitle = {
      id, jobId: '', status: 'generating',
      title: title.trim() || 'THE MINT', subtitle: subtitle.trim(),
      style: selectedStyle.name, model: selectedModel.name, prompt,
    };
    setGenerated(prev => [newTitle, ...prev]);

    try {
      const res = await fetch(`${ATLAS_API}/api/v1/model/generateVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: selectedModel.model,
          prompt,
          duration: 5,
          resolution: '720p',
          aspect_ratio: orientation === 'portrait' ? '9:16' : '16:9',
          seed: -1,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[titles] API error:', err);
        setGenerated(prev => prev.map(t => t.id === id ? { ...t, status: 'failed' } : t));
        setIsGenerating(false);
        return;
      }

      const data = await res.json();
      const jobId = data?.data?.id || data?.id || '';
      setGenerated(prev => prev.map(t => t.id === id ? { ...t, jobId, status: 'pending' } : t));

      // Start polling
      startPolling(id, jobId);
    } catch (err) {
      console.error('[titles] Generate failed:', err);
      setGenerated(prev => prev.map(t => t.id === id ? { ...t, status: 'failed' } : t));
    }
    setIsGenerating(false);
  };

  // ── Poll for result ────────────────────────────────────────────────
  const startPolling = (titleId: string, jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) { // 5 min timeout
        clearInterval(pollRef.current!);
        setGenerated(prev => prev.map(t => t.id === titleId ? { ...t, status: 'failed' } : t));
        return;
      }

      try {
        const res = await fetch(`${ATLAS_API}/api/v1/model/result/${jobId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        const data = await res.json();
        const d = data?.data || data;
        const status = (d.status || '').toLowerCase();

        if ((status === 'completed' || status === 'succeeded') && d.outputs?.[0]) {
          clearInterval(pollRef.current!);
          setGenerated(prev => prev.map(t => t.id === titleId ? { ...t, status: 'done', videoUrl: d.outputs[0] } : t));
        } else if (status === 'failed') {
          clearInterval(pollRef.current!);
          setGenerated(prev => prev.map(t => t.id === titleId ? { ...t, status: 'failed' } : t));
        }
      } catch { /* retry */ }
    }, 5000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Load title clips from file ─────────────────────────────────────
  const handleLoadTitles = async () => {
    const result = await window.mint.openImages();
    if (!result) return;
    const videos = result.filter(f => /\.(mp4|mov|webm)$/i.test(f));
    setLoadedTitles(prev => [...prev, ...videos]);
    if (videos.length > 0) setPreviewIndex(null);
  };

  // ── Preview canvas render loop ─────────────────────────────────────
  const previewUrl = previewIndex !== null
    ? (previewIndex < generated.length && generated[previewIndex].videoUrl)
      ? generated[previewIndex].videoUrl
      : null
    : null;

  const loadedPreviewPath = previewIndex !== null && previewIndex >= generated.length
    ? loadedTitles[previewIndex - generated.length]
    : null;

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (previewUrl) {
      vid.src = previewUrl;
    } else if (loadedPreviewPath) {
      vid.src = mediaStreamUrl(loadedPreviewPath);
    } else {
      vid.src = '';
      return;
    }
    vid.load();
    vid.play().catch(() => {});
  }, [previewUrl, loadedPreviewPath]);

  useEffect(() => {
    let running = true;
    const render = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) { animRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animRef.current = requestAnimationFrame(render); return; }

      const cw = orientation === 'portrait' ? 720 : 1280;
      const ch = orientation === 'portrait' ? 1280 : 720;
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const scale = Math.max(cw / video.videoWidth, ch / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      } else {
        // Static preview — draw title text
        ctx.font = `900 ${cw * 0.08}px Impact, Arial Black, sans-serif`;
        ctx.fillStyle = '#c9a84c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 12;
        const lines = (title || 'THE MINT').toUpperCase().split('\n');
        const lh = cw * 0.1;
        const startY = ch / 2 - (lines.length - 1) * lh / 2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], cw / 2, startY + i * lh);
        if (subtitle) {
          ctx.font = `400 ${cw * 0.025}px Helvetica Neue, Arial, sans-serif`;
          ctx.fillStyle = '#e6c665';
          ctx.shadowBlur = 6;
          ctx.fillText(subtitle.toUpperCase(), cw / 2, ch * 0.85);
        }
        ctx.shadowBlur = 0;
      }

      // Logo
      if (showLogo && logoImg) {
        const ls = 0.15;
        const lw = logoImg.naturalWidth * ls;
        const lh2 = logoImg.naturalHeight * ls;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.drawImage(logoImg, cw - lw - 20, 20, lw, lh2);
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [orientation, title, subtitle, showLogo, logoImg, previewUrl, loadedPreviewPath]);

  const statusColor = (s: string) => s === 'done' ? '#00ff41' : s === 'pending' || s === 'generating' ? '#ffd700' : '#c9a84c';

  return (
    <div style={{ display: 'flex', height: '100%', gap: 8, padding: 8, overflow: 'hidden' }}>
      {/* Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: 8, overflow: 'hidden', minHeight: 0, minWidth: 0, padding: 12 }}>
        <video ref={videoRef} style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, pointerEvents: 'none' }} playsInline loop autoPlay />
        <canvas ref={canvasRef} style={{
          maxWidth: orientation === 'portrait' ? '50%' : '100%',
          maxHeight: '100%', width: 'auto', height: 'auto', display: 'block',
          borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }} />
      </div>

      {/* Controls */}
      <div style={{ width: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>

        {/* Title text */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Title Text</div>
          <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} placeholder="TITLE"
            style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 14, fontWeight: 700, resize: 'none', fontFamily: 'inherit' }} />
          <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle"
            style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 12, marginTop: 4 }} />
        </div>

        {/* Style */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Style</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {TITLE_STYLES.map(s => (
              <button key={s.id} onClick={() => setSelectedStyle(s)} style={{
                padding: '6px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontWeight: 600, textAlign: 'left',
                background: selectedStyle.id === s.id ? 'rgba(255,0,64,0.15)' : 'var(--panel-2)',
                borderColor: selectedStyle.id === s.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: selectedStyle.id === s.id ? '#fff' : 'var(--muted)',
              }}>{s.name}</button>
            ))}
          </div>
        </div>

        {/* Model + orientation */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Model</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {MODELS.map(m => (
              <button key={m.id} onClick={() => setSelectedModel(m)} style={{
                padding: '6px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontWeight: 600, display: 'flex', justifyContent: 'space-between',
                background: selectedModel.id === m.id ? 'rgba(255,0,64,0.15)' : 'var(--panel-2)',
                borderColor: selectedModel.id === m.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: selectedModel.id === m.id ? '#fff' : 'var(--muted)',
              }}>
                <span>{m.name}</span>
                <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>${m.price}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {(['landscape', 'portrait'] as const).map(o => (
              <button key={o} onClick={() => setOrientation(o)} style={{
                flex: 1, padding: '5px 0', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                background: orientation === o ? 'var(--accent)' : 'var(--panel-2)',
                borderColor: orientation === o ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: '#fff',
              }}>{o === 'landscape' ? '16:9' : '9:16'}</button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>AtlasCloud API</div>
          <input type="password" value={apiKey} onChange={e => saveApiKey(e.target.value)} placeholder="API key"
            style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 11 }} />
        </div>

        {/* Generate button */}
        <button onClick={handleGenerate} disabled={isGenerating || !apiKey}
          style={{
            padding: '10px 0', background: isGenerating ? 'var(--panel-2)' : 'var(--accent)',
            border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 2, cursor: isGenerating ? 'wait' : 'pointer',
            opacity: !apiKey ? 0.4 : 1,
          }}>
          {isGenerating ? 'Generating...' : `Generate — $${selectedModel.price}`}
        </button>

        {/* Load existing titles */}
        <button onClick={handleLoadTitles}
          style={{
            padding: '8px 0', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: 'var(--muted)', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
          }}>
          Load Title Clips
        </button>

        {/* Generated + loaded titles list */}
        {(generated.length > 0 || loadedTitles.length > 0) && (
          <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>
              Titles ({generated.length + loadedTitles.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
              {generated.map((g, i) => (
                <button key={g.id} onClick={() => g.status === 'done' ? setPreviewIndex(i) : null}
                  style={{
                    padding: '6px 8px', border: '1px solid', borderRadius: 4, cursor: g.status === 'done' ? 'pointer' : 'default',
                    fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: previewIndex === i ? 'rgba(255,0,64,0.15)' : 'var(--panel-2)',
                    borderColor: previewIndex === i ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                  }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{g.title}</span>
                  <span style={{ fontSize: 8, color: statusColor(g.status), fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, marginLeft: 4 }}>
                    {g.status === 'pending' ? 'PENDING...' : g.status === 'generating' ? 'SUBMITTING' : g.status === 'done' ? g.model : 'FAILED'}
                  </span>
                </button>
              ))}
              {loadedTitles.map((path, i) => {
                const idx = generated.length + i;
                const name = path.split('/').pop() || 'title';
                return (
                  <button key={path} onClick={() => setPreviewIndex(idx)}
                    style={{
                      padding: '6px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                      fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: previewIndex === idx ? 'rgba(255,0,64,0.15)' : 'var(--panel-2)',
                      borderColor: previewIndex === idx ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                    }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{name}</span>
                    <span style={{ fontSize: 8, color: '#00ff41', fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>LOCAL</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Prompt preview */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 6 }}>Prompt Preview</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, maxHeight: 80, overflowY: 'auto' }}>{buildPrompt()}</div>
        </div>
      </div>
    </div>
  );
}
