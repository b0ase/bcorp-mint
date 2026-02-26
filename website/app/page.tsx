'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  Download,
  Palette,
  Printer,
  Stamp,
  Coins,
  ShieldCheck,
  Video,
  Music,
  ImageIcon,
  ChevronRight,
  Hash,
  Github,
  Globe,
} from 'lucide-react';
import { useEffect } from 'react';
import Link from 'next/link';

/* ── Data ─────────────────────────────────────────────────────── */

const operations = [
  {
    icon: Palette,
    name: 'Design',
    description: 'Create currency with guilloche patterns, rosettes, microprint, and 11 security layers.',
  },
  {
    icon: Printer,
    name: 'Print',
    description: 'Export high-resolution currency sheets ready for physical or digital distribution.',
  },
  {
    icon: Stamp,
    name: 'Stamp',
    description: 'SHA-256 hash any media file and inscribe the cryptographic proof to BSV.',
  },
  {
    icon: Coins,
    name: 'Mint',
    description: 'Create BSV-20 tokens with custom supply, pricing curves, and on-chain metadata.',
  },
];

const mintingSteps = [
  { label: 'DROP', color: 'text-amber-400', description: 'Drop a file — video, audio, image, or document' },
  { label: 'COMPOSE', color: 'text-yellow-400', description: 'Set token name, supply, and pricing curve' },
  { label: 'HASH', color: 'text-orange-400', description: 'SHA-256 hash computed locally on your machine' },
  { label: 'INSCRIBE', color: 'text-amber-500', description: 'OP_RETURN inscription broadcast to BSV' },
  { label: 'OWN', color: 'text-yellow-500', description: 'Token exists on-chain — tradeable, provable, yours' },
];

const securityLayers = [
  { name: 'Guilloche', description: 'Mathematically generated interlocking curves', accent: 'amber' },
  { name: 'Rosette', description: 'Circular interference patterns from overlapping waves', accent: 'yellow' },
  { name: 'Fine-line', description: 'Sub-pixel parallel lines impossible to reproduce', accent: 'orange' },
  { name: 'Border', description: 'Ornamental frames with embedded anti-counterfeit detail', accent: 'amber' },
  { name: 'Microprint', description: 'Text readable only under magnification', accent: 'yellow' },
  { name: 'Text', description: 'Variable typography with denomination and serial data', accent: 'orange' },
  { name: 'Image', description: 'Portrait or emblem layer with halftone protection', accent: 'amber' },
  { name: 'QR Code', description: 'Encoded verification linking to on-chain proof', accent: 'yellow' },
  { name: 'Security Thread', description: 'Embedded metallic strip simulation', accent: 'orange' },
  { name: 'Watermark', description: 'Translucent background pattern visible on hold', accent: 'amber' },
  { name: 'Serial Number', description: 'Unique identifier per note for supply tracking', accent: 'yellow' },
];

const accentColors: Record<string, { border: string; dot: string }> = {
  amber: { border: 'border-amber-500/20', dot: 'bg-amber-500' },
  yellow: { border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
  orange: { border: 'border-orange-500/20', dot: 'bg-orange-500' },
};

const tokenModes = [
  {
    icon: Video,
    name: 'Video',
    description: 'Tokenise video files — each frame or clip becomes a tradeable on-chain asset.',
    path: '$TOKEN/video/001',
  },
  {
    icon: Music,
    name: 'Audio',
    description: 'Tokenise audio tracks — stems, samples, or full compositions inscribed to BSV.',
    path: '$TOKEN/audio/001',
  },
  {
    icon: ImageIcon,
    name: 'Images',
    description: 'Tokenise image sets — photographs, artwork, or generated media as BSV-20 tokens.',
    path: '$TOKEN/image/001',
  },
];

const techStack = [
  { label: 'FRAMEWORK', value: 'Electron' },
  { label: 'RENDERER', value: 'React + TypeScript' },
  { label: 'GRAPHICS', value: 'HTML5 Canvas' },
  { label: 'BLOCKCHAIN', value: 'BSV (BSV-20)' },
  { label: 'WALLET', value: 'HandCash Connect' },
  { label: 'ANIMATION', value: 'Framer Motion' },
  { label: 'MEDIA', value: 'FFmpeg (local)' },
  { label: 'THEME', value: 'Dark only' },
];

/* ── Component ────────────────────────────────────────────────── */

export default function HomePage() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <div className="font-[family-name:var(--font-mono)] min-h-screen">

      {/* ── 1. Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/mint/video-rosette.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black" />

        {/* Content */}
        <div className="relative z-10 px-4 md:px-8 py-24 max-w-5xl mx-auto text-center">
          {/* App icon + label */}
          <motion.div
            className="flex items-center justify-center gap-4 mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 md:w-20 md:h-20 relative border border-white/10 bg-black/50 backdrop-blur-sm overflow-hidden rounded-xl">
              <Image
                src="/mint/bcorp-mint-icon.png"
                alt="Bitcoin Mint"
                fill
                className="object-cover"
              />
            </div>
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80 mb-1">
                The Bitcoin Corporation
              </div>
              <div className="text-sm text-zinc-500">Currency Designer</div>
            </div>
          </motion.div>

          {/* Title — per-character animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <h1
              className="font-black tracking-tighter leading-[0.85] text-white"
              style={{
                fontFamily: 'var(--font-orbitron), Orbitron, sans-serif',
                fontSize: 'clamp(4rem, 12vw, 10rem)',
              }}
            >
              {'MINT'.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
            </h1>

            {/* Reflection */}
            <div
              className="relative overflow-hidden h-6 md:h-10 select-none mx-auto"
              aria-hidden="true"
              style={{
                transform: 'scaleY(-1)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent 80%)',
                maskImage: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent 80%)',
              }}
            >
              <div
                className="text-white/20 font-black tracking-tighter leading-[0.85] text-center"
                style={{
                  fontFamily: 'var(--font-orbitron), Orbitron, sans-serif',
                  fontSize: 'clamp(4rem, 12vw, 10rem)',
                }}
              >
                MINT
              </div>
            </div>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="text-amber-400/80 text-xl md:text-2xl tracking-[0.2em] uppercase font-bold mb-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            The Currency Designer
          </motion.p>

          {/* Tagline */}
          <motion.p
            className="text-zinc-500 text-lg md:text-xl mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Design. Print. Stamp. Mint.
          </motion.p>

          {/* Download CTA */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <a
              href="https://github.com/b0ase/bcorp-mint/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 rounded-full"
            >
              <Download size={18} />
              Download Desktop App
            </a>
          </motion.div>

          {/* Browser CTA */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75 }}
          >
            <Link
              href="/hash"
              className="inline-flex items-center gap-3 px-8 py-3 border border-amber-500/40 hover:border-amber-400 text-amber-400 hover:text-amber-300 font-bold text-sm uppercase tracking-widest transition-all rounded-full"
            >
              <Globe size={16} />
              Hash in Browser
            </Link>
          </motion.div>

          {/* Size note */}
          <motion.p
            className="text-xs text-zinc-600 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Free &middot; ~130 MB &middot; macOS, Windows, Linux
          </motion.p>

          {/* Privacy badge */}
          <motion.div
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            <ShieldCheck size={14} className="text-zinc-600" />
            No telemetry. No cloud. No accounts.
          </motion.div>
        </div>
      </section>

      {/* ── 2. Four Operations ───────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.h2
          className="text-sm font-bold tracking-widest text-white/40 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          FOUR OPERATIONS
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {operations.map((op, i) => (
            <motion.div
              key={op.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-white/10 bg-black/40 backdrop-blur-sm p-5 rounded-xl"
            >
              <op.icon size={20} className="text-amber-400 mb-3" />
              <h3 className="font-bold text-sm uppercase tracking-wide mb-1">{op.name}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{op.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 3. The Minting Process ───────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.h2
          className="text-sm font-bold tracking-widest text-white/40 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          THE MINTING PROCESS
        </motion.h2>

        {/* Step flow */}
        <div className="flex flex-col md:flex-row items-stretch gap-3 mb-8">
          {mintingSteps.map((step, i) => (
            <div key={step.label} className="flex-1 flex flex-col md:flex-row items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex-1 w-full p-4 rounded-xl border border-white/10 bg-white/[0.03] text-center"
              >
                <div className={`text-sm font-bold tracking-widest mb-2 ${step.color}`}>
                  {step.label}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.description}</p>
              </motion.div>
              {i < mintingSteps.length - 1 && (
                <ChevronRight size={16} className="text-white/20 hidden md:block shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* OP_RETURN format */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-white/10 bg-white/[0.03] rounded-xl p-5"
        >
          <div className="text-[10px] font-bold tracking-widest text-white/30 mb-3">OP_RETURN FORMAT</div>
          <pre className="text-xs text-amber-400/80 overflow-x-auto">
{`OP_RETURN
  "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5"  // B:// protocol
  <media_bytes>                            // File content
  "application/octet-stream"               // MIME type
  "UTF-8"                                  // Encoding
  <filename>                               // Original filename
  |
  "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut"  // MAP protocol
  "SET"
  "app"        "bitcoin-mint"
  "type"       "stamp"
  "sha256"     <hash>                      // SHA-256 of original
  "filename"   <name>
  "timestamp"  <iso8601>`}
          </pre>
        </motion.div>
      </section>

      {/* ── 4. Document Hash Inscription ─────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.h2
          className="text-sm font-bold tracking-widest text-white/40 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          DOCUMENT HASH INSCRIPTION
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-white/10 bg-white/[0.03] backdrop-blur-sm rounded-xl p-8"
        >
          <div className="flex items-start gap-4 mb-6">
            <Hash size={28} className="text-amber-400 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Hash documents to the blockchain</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                SHA-256 hash any file — contracts, patents, artwork, legal documents — and inscribe
                the hash on BSV via OP_RETURN. The document stays local. Only the cryptographic
                proof goes on-chain, creating an immutable timestamp of existence.
              </p>
            </div>
          </div>
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-400/80">
              No download required —{' '}
              <Link href="/hash" className="underline hover:text-amber-300 transition-colors font-bold">
                hash and inscribe directly from your browser
              </Link>{' '}
              with HandCash.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Sign with HandCash', desc: 'OAuth wallet signing — no keys to manage' },
              { label: 'Sign with local wallet', desc: 'Self-custody WIF or HD master key' },
              { label: 'Batch inscription', desc: 'Hash multiple documents in a single transaction' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="border border-white/10 bg-black/40 rounded-lg p-4"
              >
                <div className="text-xs text-amber-400/80 font-bold tracking-wider mb-1">{item.label}</div>
                <p className="text-[11px] text-zinc-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── 5. Security Layers ───────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.h2
          className="text-sm font-bold tracking-widest text-white/40 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          SECURITY LAYERS
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {securityLayers.map((layer, i) => {
            const colors = accentColors[layer.accent];
            return (
              <motion.div
                key={layer.name}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className={`p-4 rounded-xl border bg-white/[0.03] ${colors.border}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
                  <h3 className="font-bold text-sm">{layer.name}</h3>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed ml-5">{layer.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── 6. Three Modes ───────────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.h2
          className="text-sm font-bold tracking-widest text-white/40 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          TOKENISATION MODES
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tokenModes.map((mode, i) => (
            <motion.div
              key={mode.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-white/10 bg-black/40 backdrop-blur-sm p-6 rounded-xl"
            >
              <mode.icon size={24} className="text-amber-400 mb-4" />
              <h3 className="font-bold text-base uppercase tracking-wide mb-2">{mode.name}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-4">{mode.description}</p>
              <code className="text-[10px] text-amber-400/60 tracking-wider">{mode.path}</code>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 7. Privacy First ─────────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-white/10 bg-white/[0.03] backdrop-blur-sm rounded-xl p-8 md:p-12 text-center"
        >
          <ShieldCheck size={32} className="text-amber-400 mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-black mb-4">
            Your printing press. Your rules.
          </h2>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto mb-8">
            Everything runs locally on your machine. No server calls. No analytics endpoints.
            No user accounts. The app works fully offline — the only network call is the BSV
            broadcast when you choose to inscribe.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            {['No telemetry', 'No cloud', 'No accounts', 'No analytics'].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="border border-white/10 bg-black/40 rounded-lg p-3"
              >
                <div className="text-xs text-amber-400/80 font-bold tracking-wider">{item}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── 8. The Stack ─────────────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.h2
          className="text-sm font-bold tracking-widest text-white/40 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          THE STACK
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {techStack.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="p-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-baseline gap-4"
            >
              <span className="text-[10px] font-bold tracking-widest text-white/30 w-28 shrink-0">
                {item.label}
              </span>
              <span className="text-sm text-white/80">{item.value}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 9. Download CTA ──────────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-white/10 bg-white/[0.03] backdrop-blur-sm rounded-xl p-10 text-center"
        >
          {/* App icon */}
          <div className="w-20 h-20 relative border border-white/10 bg-black/50 backdrop-blur-sm overflow-hidden rounded-xl mx-auto mb-6">
            <Image
              src="/mint/bcorp-mint-icon.png"
              alt="Bitcoin Mint"
              fill
              className="object-cover"
            />
          </div>

          <h2 className="text-2xl md:text-3xl font-black mb-2">Download Bitcoin Mint</h2>

          <p
            className="text-5xl font-black text-amber-500 mb-4"
            style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}
          >
            FREE
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
            {[
              { label: 'macOS', file: 'The%20Bitcoin%20Corporation%20Mint-0.2.1-arm64.dmg', note: 'Apple Silicon' },
              { label: 'Windows', file: 'The%20Bitcoin%20Corporation%20Mint%20Setup%200.2.1.exe', note: 'Installer' },
              { label: 'Linux', file: 'The%20Bitcoin%20Corporation%20Mint-0.2.1-arm64.AppImage', note: 'AppImage' },
            ].map((platform) => (
              <a
                key={platform.label}
                href={`https://github.com/b0ase/bcorp-mint/releases/download/v0.2.1/${platform.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 rounded-xl"
              >
                <Download size={14} />
                <span>{platform.label}</span>
                <span className="text-[9px] font-normal text-black/60 normal-case tracking-normal">{platform.note}</span>
              </a>
            ))}
          </div>

          <Link
            href="/hash"
            className="inline-flex items-center gap-3 px-8 py-3 border border-amber-500/40 hover:border-amber-400 text-amber-400 hover:text-amber-300 font-bold text-sm uppercase tracking-widest transition-all rounded-full"
          >
            <Globe size={16} />
            Hash in Browser
          </Link>
        </motion.div>
      </section>

      {/* ── 10. Open Source ───────────────────────────────────── */}
      <section className="px-4 md:px-8 py-20 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Github size={24} className="text-white/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Open Source</h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
            The Mint is open source. Fork it. Inspect every line. Build on it.
            No hidden network calls, no obfuscated binaries.
          </p>
          <a
            href="https://github.com/b0ase/bcorp-mint"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Github size={16} />
            github.com/b0ase/bcorp-mint
          </a>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="text-center pb-12">
        <p className="text-xs text-white/20">
          The Currency Designer
        </p>
        <p className="text-xs mt-2 text-white/20">
          <a href="https://thebitcoincorporation.website" className="hover:underline" target="_blank" rel="noopener noreferrer">The Bitcoin Corporation</a>
          {' '}&middot;{' '}
          <a href="https://b0ase.com" className="hover:underline" target="_blank" rel="noopener noreferrer">b0ase</a>
        </p>
      </div>
    </div>
  );
}
