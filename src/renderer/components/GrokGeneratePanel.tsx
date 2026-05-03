// Grok / BSVAPI / AtlasCloud generation panel for bCorp Mint.
//
// Pulls scope-aware prompts and AI providers from @b0ase/creator-tool-core.
// Generated images become banknote layers via the existing onAddImageFromUrl
// path. No app-specific provider logic lives here — adding a new provider
// (KLING, SeeDance, ComfyUI local) means registering it in creator-tool-core
// and adding one row to the picker below.

import React, { useState } from 'react';
import {
  buildPrompt,
  bsvapiProvider,
  grokImagineProvider,
  atlasCloudProvider,
  type AIProvider,
  type PromptScope,
  type GenerateResult
} from '@b0ase/creator-tool-core';
import { getKey, setKey, type ProviderKey } from '../lib/ai-keys';

type Props = {
  /** When the user generates an image, add it to the canvas as a layer. */
  onAddImageFromUrl: (src: string, name: string) => void;
  /** Default scope for this Mint. bCorp Mint = banknote. */
  scope?: PromptScope;
};

type ProviderChoice = {
  id: 'bsvapi' | 'grok-imagine' | 'atlascloud';
  label: string;
  provider: AIProvider;
  keyName: ProviderKey;
  keyHint: string;
  baseHint?: ProviderKey;
};

const CHOICES: ProviderChoice[] = [
  {
    id: 'bsvapi',
    label: 'BSVAPI (pay per call)',
    provider: bsvapiProvider,
    keyName: 'bsvapi',
    keyHint: 'bsvapi_sk_...',
    baseHint: 'bsvapi-base'
  },
  {
    id: 'grok-imagine',
    label: 'Grok Imagine (direct, xAI key)',
    provider: grokImagineProvider,
    keyName: 'grok-imagine',
    keyHint: 'xai-...'
  },
  {
    id: 'atlascloud',
    label: 'AtlasCloud (direct, your key)',
    provider: atlasCloudProvider,
    keyName: 'atlascloud',
    keyHint: 'sk-...'
  }
];

export default function GrokGeneratePanel({ onAddImageFromUrl, scope = 'banknote' }: Props) {
  const [choiceIdx, setChoiceIdx] = useState(0);
  const choice = CHOICES[choiceIdx]!;
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState<string>(() => getKey(choice.keyName) ?? '');
  const [baseUrl, setBaseUrl] = useState<string>(() =>
    choice.baseHint ? (getKey(choice.baseHint) ?? '') : ''
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [showKey, setShowKey] = useState(false);

  const onChangeChoice = (i: number) => {
    setChoiceIdx(i);
    const next = CHOICES[i]!;
    setApiKey(getKey(next.keyName) ?? '');
    setBaseUrl(next.baseHint ? (getKey(next.baseHint) ?? '') : '');
  };

  const persistKey = () => {
    setKey(choice.keyName, apiKey.trim() || undefined);
    if (choice.baseHint) setKey(choice.baseHint, baseUrl.trim() || undefined);
    setStatus('Saved.');
    setTimeout(() => setStatus(''), 1500);
  };

  const onGenerate = async () => {
    if (!prompt.trim()) {
      setStatus('Enter a prompt.');
      return;
    }
    if (!apiKey.trim()) {
      setStatus('API key required.');
      return;
    }
    setBusy(true);
    setStatus('Generating…');
    try {
      const built = buildPrompt({ scope, userPrompt: prompt });
      const opts: { apiKey: string; baseUrl?: string } = { apiKey: apiKey.trim() };
      if (baseUrl.trim()) opts.baseUrl = baseUrl.trim();
      const result: GenerateResult = await choice.provider.generate(
        { scope, userPrompt: prompt, width: built.width, height: built.height },
        opts
      );
      const src = result.dataUrl ?? result.url;
      if (!src) throw new Error('No image returned.');
      const safeName = `ai-${scope}-${Date.now()}`;
      onAddImageFromUrl(src, safeName);
      const cost = result.meta?.costSatoshis ? ` (${result.meta.costSatoshis} sats)` : '';
      setStatus(`Added as layer.${cost}`);
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-gen-panel" style={panelStyle}>
      <div style={headerStyle}>
        <span>AI Generate ({scope})</span>
      </div>

      <select
        value={choiceIdx}
        onChange={(e) => onChangeChoice(Number(e.target.value))}
        style={inputStyle}
        disabled={busy}
      >
        {CHOICES.map((c, i) => (
          <option key={c.id} value={i}>{c.label}</option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={persistKey}
          placeholder={choice.keyHint}
          style={{ ...inputStyle, flex: 1 }}
          disabled={busy}
        />
        <button onClick={() => setShowKey((v) => !v)} style={tinyBtnStyle} title={showKey ? 'Hide' : 'Show'}>
          {showKey ? '🙈' : '👁'}
        </button>
      </div>

      {choice.baseHint && (
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          onBlur={persistKey}
          placeholder="Base URL (optional, default https://bsvapi.com)"
          style={inputStyle}
          disabled={busy}
        />
      )}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={`Describe the ${scope}... e.g. "100 NPG note, gold reserve, art-deco filigree, queen portrait"`}
        rows={3}
        style={{ ...inputStyle, resize: 'both', fontFamily: 'inherit', minHeight: 60, maxWidth: '100%' }}
        disabled={busy}
      />

      <button onClick={onGenerate} disabled={busy} style={primaryBtnStyle}>
        {busy ? 'Generating…' : 'Generate → add as layer'}
      </button>

      {status && (
        <div style={{ fontSize: 11, opacity: 0.85, color: status.startsWith('Failed') ? '#ff7a7a' : '#9ad' }}>
          {status}
        </div>
      )}

      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
        Keys stored locally only. Generated images become banknote layers.
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  borderRadius: 6,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  marginBottom: 8
};

const headerStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  opacity: 0.85,
  letterSpacing: 0.5,
  textTransform: 'uppercase'
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  color: 'inherit',
  padding: '4px 6px',
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box'
};

const tinyBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  cursor: 'pointer',
  padding: '4px 6px',
  fontSize: 12
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#3a7afe',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer'
};
