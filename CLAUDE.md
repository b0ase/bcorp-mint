# The Mint

> The Bitcoin Corporation's Mint. Design, print, stamp, and mint currency on BSV.

## Product Vision

The Mint is not a metaphor — it is a literal mint. It designs, prints, stamps, and mints currency for the Bitcoin Corporation. The same four operations any national mint performs:

1. **Design** — Logo designer, framing, vignette, visual identity for the currency
2. **Print** — Issue creation, batch export, media rendering
3. **Stamp** — SHA-256 hash, BSV inscription, on-chain proof of authenticity
4. **Mint** — BSV-20 token creation, the actual currency

The Mint is infrastructure — a general-purpose minting machine with a totally objective relationship to the brands and media that pass through it. It does not belong to NPG, or any brand. NPG just happens to use it, like a printing press doesn't belong to any one newspaper.

It works with any media — images, video, generative AI output, encrypted packages, identity proofs — and writes certified stamps directly to chain. It is the creation tool that produces assets for the b0ase protocol stack: `$401` (identity), `$402` (payments), `$403` (securities).

Stamp profiles (NPG, Magazine, 1ShotComics, Bitcoin Books, etc.) are configurations loaded into the machine — they are not the machine's identity. The UI says **"The Mint"** at the top. The profiles configure stamp paths, logo defaults, and issue naming.

## Privacy Principle — Non-Negotiable

**The Mint must never save any data from the user, about the user, or about the minted objects.**

It is purely a tool that users can use with total discretion. Like a notary stamp that keeps no copies of what it stamps.

Concretely:

- **No telemetry, no analytics, no phone-home.** Zero network calls except to BSV (for inscription) and ComfyUI (local, user-initiated).
- **No cloud storage.** All files stay on the user's machine. All processing happens on-device.
- **No user accounts.** Wallet connection is ephemeral — HandCash OAuth for signing, then forget.
- **Stamp receipts are the user's property.** Stored in their local filesystem (`userData/stamps/`), never synced or uploaded anywhere.
- **The chain is the only record.** If the user inscribes, the blockchain has the proof. The Mint does not need to remember it happened.
- **No usage tracking of any kind.** Don't add logging, crash reporters, or update checkers that transmit data.

This principle applies to all current and future Mint variants. Any feature that would compromise user privacy must be rejected outright.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 30+ (electron-vite) |
| Renderer | React 18, TypeScript |
| Blockchain | BSV-20/21 via `@bsv/sdk` + `js-1sat-ord` |
| Wallet | HandCash OAuth (ephemeral) |
| AI Animation | ComfyUI (local, SVD + Wan 2.1 workflows) |
| Media Processing | ffmpeg-static (frame extraction, audio segmentation, waveform) |
| Package Manager | pnpm |

## Architecture

```
src/
  main/           — Electron main process
    index.ts      — Window, IPC handlers, protocol, ComfyUI integration
    bsv.ts        — BSV inscription logic (extended OP_RETURN with parent/index metadata)
    handcash.ts   — Wallet OAuth
    keystore.ts   — Local private key storage
    token-mint.ts — BSV-21 token minting (single + batch, custom icons)
    media-extract.ts — ffmpeg operations (probe, frame extraction, audio segmentation, waveform)
  preload/
    index.ts      — contextBridge (window.mint)
  renderer/
    App.tsx        — Root component, mode routing, state management
    hooks/
      useTokenisation.ts — Tokenisation state hook (frames, segments, selection)
    lib/
      types.ts     — ImageItem, Spread, ExtractedFrame, AudioSegment, TokenisationPiece, AppMode
      image-utils.ts — loadImage, loadVideoThumbnail, mediaStreamUrl, isAudioFile
      defaults.ts  — Default settings factory
      logos.ts     — Logo generation (text, SVG, designed)
      render.ts    — Canvas draw helpers (vignette, frame, watermark, logo)
    components/
      CanvasPreview.tsx  — 2D canvas rendering of spreads
      FlipBookView.tsx   — Page-turn view (react-pageflip)
      FrameBrowser.tsx   — Video frame grid/timeline browser with selection
      LogoDesigner.tsx   — SVG logo designer modal
      ModeToggle.tsx     — Stamp/Tokenise segmented control
      PageStrip.tsx      — Bottom filmstrip + ComfyUI animate controls
      TokenisePanel.tsx  — Right panel for tokenise mode (extraction, stamping, minting)
      WaveformEditor.tsx — Audio waveform canvas with segment creation/editing
```

## Media Support

| Type | Extensions | How Loaded |
|------|-----------|------------|
| Images | .jpg .jpeg .png .webp .tif .tiff .bmp | Base64 data URL via IPC (`file-url`) |
| Videos | .mp4 .mov .webm .avi | Streaming via `mint-media://` custom protocol |
| Audio | .mp3 .wav .flac .aac .ogg .m4a | Streaming via `mint-media://` protocol + waveform thumbnail |

Videos extract their first frame as a JPEG thumbnail for canvas rendering. The thumbnail goes through the same framing/logo/vignette pipeline as images. Playback uses the streaming protocol directly.

Audio files generate a waveform PNG thumbnail via ffmpeg for sidebar display. Full playback uses the streaming protocol with `<audio>` element.

## Key Flows

**Load media** — Folder scan, file picker, or drag-and-drop. Extension-filtered at three points: main process `SUPPORTED_EXT`, dialog filters, renderer-side `SUPPORTED_EXT`.

**Canvas rendering** — `CanvasPreview` draws image/thumbnail via `ctx.drawImage()`, then overlays vignette, frame, watermark, logo, border stamp, and selection highlight.

**Stamp & Inscribe** — SHA-256 hash of source file, write receipt to local `userData/stamps/`, optionally inscribe to BSV via local keystore.

**Animate** — Upload source image to local ComfyUI, queue SVD or Wan 2.1 workflow, poll for completion, download MP4 result.

## Tokenisation Mode

The Mint has two modes, toggled in the topbar: **Stamp** (original flow) and **Tokenise** (media decomposition).

### Three Pipelines

1. **Video** — Extract frame sequences via ffmpeg. Each frame becomes a selectable piece. Grid or timeline view for browsing/selecting frames.
2. **Audio** — Waveform visualization with segment creation (click+drag or auto-interval). Each segment is a tokenisable piece.
3. **Images** — Single-item tokenisation (same as stamp mode mint).

### Token Path Convention

```
Video:  {rootPath}/FRAME-{NNN}     e.g. $MINT/VIDEO-01/FRAME-042
Audio:  {rootPath}/SEGMENT-{NNN}   e.g. $MINT/AUDIO-01/SEGMENT-003
```

### Extended OP_RETURN

Tokenised pieces include parent/index metadata in the inscription:

```
STAMP | path | sha256 | timestamp | PARENT:source-hash | INDEX:42 | TOTAL:500
```

Any indexer can reconstruct the full sequence from on-chain data.

### Batch Minting

`batchMintTokens()` in `token-mint.ts` handles high-volume BSV-21 token creation with:
- Per-piece custom icons (frame thumbnails or waveform segments)
- 200ms rate limiting between mints
- Progress events via `webContents.send('mint-progress')`

### Privacy

All extraction happens in `app.getPath('temp')/mint-{randomId}/`. Temp dirs are cleaned on:
- Media removal from the app
- Component unmount
- `app.on('before-quit')` (registered in `registerCleanupOnQuit()`)

No extracted data persists beyond the session.

## Variant Configuration

What differs per branded variant (all else is shared core):

| Config | Example (NPG profile) | Example (Magazine profile) |
|--------|----------------------|--------------------------|
| Default logo text | `MINT` | `MINT` |
| Stamp path prefix | `$MINT/SERIES-01/ISSUE-1` | `$MINT/SERIES-01/ISSUE-1` |
| Issue folder pattern | `mint-NNN` | `mint-NNN` |

The app name is always **"The Mint"**. Profiles are stamp configurations, not app identities.

Future: profile selector UI where users create, switch, and configure stamp profiles within the single app.

## Rules

1. **Privacy above all.** Never add telemetry, cloud sync, user tracking, or any data exfiltration.
2. **Local-first.** All processing on-device. The only external calls are BSV transactions (user-initiated) and local ComfyUI.
3. **pnpm always.** Never npm or yarn.
4. **TypeScript strict.** All code is TypeScript.
5. **No secrets in git.** Use `.env.local` for any keys.
