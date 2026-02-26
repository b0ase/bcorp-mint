'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Hash,
  ShieldCheck,
  Wallet,
  CheckCircle,
  X,
  ExternalLink,
  LogOut,
  FileText,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface HashedFile {
  filename: string;
  sha256: string;
  size: number;
  timestamp: string;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HashPage() {
  const [files, setFiles] = useState<HashedFile[]>([]);
  const [hashing, setHashing] = useState(false);
  const [inscribing, setInscribing] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHandle(getCookie('bm_user_handle'));
  }, []);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    setHashing(true);
    setError(null);
    setTxid(null);

    try {
      const newFiles: HashedFile[] = [];
      for (const file of Array.from(fileList)) {
        const sha256 = await hashFile(file);
        newFiles.push({
          filename: file.name,
          sha256,
          size: file.size,
          timestamp: new Date().toISOString(),
        });
      }
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      setError('Failed to hash one or more files');
      console.error(err);
    } finally {
      setHashing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setTxid(null);
  };

  const inscribe = async () => {
    if (!files.length) return;
    setInscribing(true);
    setError(null);

    try {
      const res = await fetch('/api/inscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashes: files.map((f) => ({
            filename: f.filename,
            sha256: f.sha256,
            timestamp: f.timestamp,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inscription failed');

      setTxid(data.txid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription failed');
    } finally {
      setInscribing(false);
    }
  };

  return (
    <div className="font-[family-name:var(--font-mono)] min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/hero-banknote.jpg"
          alt=""
          fill
          className="object-cover opacity-20"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/80 to-black" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 relative border border-white/10 bg-black/50 overflow-hidden rounded-lg">
            <Image
              src="/mint/bcorp-mint-icon.png"
              alt="Bitcoin Mint"
              fill
              className="object-cover"
            />
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-400 transition-colors">
            Bitcoin Mint
          </span>
        </Link>

        {handle ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-400/80 font-bold tracking-wider">
              {handle}
            </span>
            <a
              href="/api/auth/logout"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Disconnect"
            >
              <LogOut size={14} />
            </a>
          </div>
        ) : null}
      </header>

      {/* Main Content */}
      <main className="px-4 md:px-8 py-12 max-w-5xl mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1
            className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-3"
            style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}
          >
            HASH
          </h1>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Drop files to compute SHA-256 hashes locally, then inscribe the proof to BSV.
          </p>
        </motion.div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center
            transition-all duration-200
            ${
              dragOver
                ? 'border-amber-400 bg-amber-400/5 scale-[1.01]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
          <Upload
            size={32}
            className={`mx-auto mb-4 transition-colors ${
              dragOver ? 'text-amber-400' : 'text-zinc-600'
            }`}
          />
          <p className="text-sm text-zinc-400 mb-1">
            {hashing ? 'Hashing...' : 'Drop files here or click to browse'}
          </p>
          <p className="text-xs text-zinc-600">
            Any file type. Files never leave your device.
          </p>
        </motion.div>

        {/* Hash Results */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 space-y-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold tracking-widest text-white/40 uppercase">
                  Hashed Files ({files.length})
                </h2>
                <button
                  onClick={() => {
                    setFiles([]);
                    setTxid(null);
                  }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Clear all
                </button>
              </div>

              {files.map((file, i) => (
                <motion.div
                  key={`${file.filename}-${file.sha256}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.05 }}
                  className="border border-white/10 bg-white/[0.03] rounded-xl p-4 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <FileText
                        size={16}
                        className="text-amber-400 shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold truncate">
                            {file.filename}
                          </span>
                          <span className="text-[10px] text-zinc-600 shrink-0">
                            {formatSize(file.size)}
                          </span>
                        </div>
                        <code className="text-[11px] text-amber-400/70 break-all leading-relaxed block">
                          {file.sha256}
                        </code>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-col items-center gap-4"
          >
            {!handle ? (
              <a
                href="/api/auth/handcash"
                className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 rounded-full"
              >
                <Wallet size={16} />
                Connect HandCash to Inscribe
              </a>
            ) : (
              <button
                onClick={inscribe}
                disabled={inscribing}
                className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:text-zinc-500 text-black font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 disabled:shadow-none rounded-full"
              >
                <Hash size={16} />
                {inscribing ? 'Inscribing...' : 'Inscribe to BSV'}
              </button>
            )}

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-xs text-center"
              >
                {error}
              </motion.p>
            )}

            {/* Success */}
            {txid && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-green-500/20 bg-green-500/5 rounded-xl p-6 text-center w-full max-w-lg"
              >
                <CheckCircle size={24} className="text-green-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-green-400 mb-2">
                  Inscribed on BSV
                </p>
                <a
                  href={`https://whatsonchain.com/tx/${txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors break-all"
                >
                  <code>{txid}</code>
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Privacy Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-600">
            <ShieldCheck size={14} />
            Files never leave your device. Only the SHA-256 hash goes on-chain.
          </div>
        </motion.div>
      </main>
    </div>
  );
}
