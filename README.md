# The Bitcoin Corporation Mint

Desktop app for designing currency, stamping media with SHA-256 proofs, and minting BSV-20 tokens.

**Design. Print. Stamp. Mint.**

## Four Operations

| Operation | Description |
|-----------|-------------|
| **Design** | Create currency with guilloche patterns, rosettes, microprint, and 11 security layers |
| **Print** | Export high-resolution currency sheets for physical or digital distribution |
| **Stamp** | SHA-256 hash any media file and inscribe the cryptographic proof to BSV |
| **Mint** | Create BSV-20 tokens with custom supply, pricing curves, and on-chain metadata |

## Tokenisation Modes

- **Video** — Extract frame sequences, each frame becomes a tradeable on-chain token
- **Audio** — Waveform segmentation, each segment inscribed with parent/index metadata
- **Images** — Single-item tokenisation with SHA-256 stamping

## Privacy

No telemetry. No cloud. No accounts. No analytics.

Everything runs locally on your machine. The only network call is the BSV broadcast when you choose to inscribe. All extraction happens in temp directories that are cleaned on quit.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron (electron-vite) |
| Renderer | React, TypeScript |
| Graphics | HTML5 Canvas |
| Blockchain | BSV-20/21 via `@bsv/sdk` + `js-1sat-ord` |
| Wallet | HandCash Connect |
| AI Animation | ComfyUI (local, SVD + Wan 2.1) |
| Media | ffmpeg (frame extraction, audio segmentation, waveform) |

## Setup

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm dist:mac     # macOS (.dmg)
pnpm dist:win     # Windows (.exe)
pnpm dist:linux   # Linux (.AppImage)
```

## Download

Pre-built binaries available on the [Releases](https://github.com/b0ase/bcorp-mint/releases) page.

Free. ~130 MB. macOS, Windows, Linux.

## License

Copyright 2026 The Bitcoin Corporation.
