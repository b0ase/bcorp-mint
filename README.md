# NPG Maker

Local Electron app for framing images, applying logos, adding vignette effects, and exporting branded batches.

## Features
- Load a folder of images (JPEG/PNG/WebP/TIFF/BMP)
- Apply a frame, vignette, and logo to every image
- Drag the logo directly on the canvas to reposition it per image
- Toggle vignette on/off or tune its strength per image
- Built-in NPG logo gallery + import + quick text logo generator
- Export a single image or bulk export the full set

## Project Layout
- `src/main` Electron main process
- `src/preload` Secure IPC bridge
- `src/renderer` React UI and canvas renderer

## Setup
```bash
pnpm install
pnpm dev
```

## Build
```bash
pnpm build
```

## Notes
- Exported files are PNG for best logo/frame fidelity.
- Fonts are loaded from Google Fonts in `styles.css`.
