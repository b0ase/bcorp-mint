# The Bitcoin Corporation Mint

Design, stamp, and mint currency on Bitcoin SV. Available as a desktop app and web PWA.

**Design. Print. Stamp. Mint.**

**Web App**: [bitcoin-mint.com/mint](https://www.bitcoin-mint.com/mint)

## Four Operations

| Operation | Description |
|-----------|-------------|
| **Design** | Create currency with guilloche patterns, rosettes, microprint, and 11 security layers |
| **Print** | Export high-resolution currency sheets for physical or digital distribution |
| **Stamp** | SHA-256 hash any media file and inscribe the cryptographic proof to BSV |
| **Mint** | Create BSV-21 tokens as 1Sat Ordinal inscriptions with on-chain metadata |

## Standards

| Standard | Support | Description |
|----------|---------|-------------|
| **BSV-21** | Full | Fungible token deployment via 1Sat Ordinals |
| **1Sat Ordinals** | Full | Inscription format for on-chain data |
| **BRC-100** | Compatible | BSV wallet interface standard (wallet-to-app communication) |
| **BSV-20** | Full | Token metadata format (`application/bsv-20`) |

### BRC-100 Compatibility

The Mint uses the BSV wallet interface standard for all blockchain operations:
- Transaction building via `@bsv/sdk` (BRC-100 compatible SDK)
- HD wallet key derivation (BRC-42/43 key management)
- OP_RETURN inscription format (BRC-compliant data encoding)
- 1Sat Ordinal inscription envelopes (`OP_FALSE OP_IF "ord" ... OP_ENDIF`)
- Broadcast via WhatsOnChain + GorillaPool ARC (1Sat indexer)

## Tokenisation Modes

- **Video** -- Extract frame sequences, each frame becomes a tradeable on-chain token
- **Audio** -- Waveform segmentation, each segment inscribed with parent/index metadata
- **Images** -- Single-item tokenisation with SHA-256 stamping

## Privacy

No telemetry. No cloud. No accounts. No analytics.

Everything runs locally on your machine. The only network call is the BSV broadcast when you choose to inscribe. All extraction happens in temp directories that are cleaned on quit.

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron (electron-vite) |
| Web | Next.js 15 (PWA) |
| Renderer | React, TypeScript |
| Graphics | HTML5 Canvas |
| Blockchain | BSV-21 via `@bsv/sdk` + 1Sat Ordinals |
| Wallet | Local HD wallet (IndexedDB) + HandCash Connect |
| AI Animation | ComfyUI (local, SVD + Wan 2.1) |
| Media | ffmpeg (frame extraction, audio segmentation, waveform) |

## Setup

```bash
pnpm install
pnpm dev
```

### Web App

```bash
cd website
pnpm install
pnpm dev
```

## Build

```bash
# Desktop
pnpm dist:mac     # macOS (.dmg)
pnpm dist:win     # Windows (.exe)
pnpm dist:linux   # Linux (.AppImage)

# Web
cd website && pnpm build
```

## Download

Pre-built binaries available on the [Releases](https://github.com/b0ase/bcorp-mint/releases) page.

Free. ~130 MB. macOS, Windows, Linux.

## License

Copyright 2026 The Bitcoin Corporation.
