export type StampVisualSettings = {
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkPosition: 'center' | 'diagonal' | 'bottom-right';
  borderStampEnabled: boolean;
  borderStampText: string;
};

export type StampReceipt = {
  id: string;
  path: string;
  hash: string;
  algorithm: 'sha256';
  sourceFile: string;
  sourceSize: number;
  timestamp: string;
  txid: string | null;
  tokenId: string | null;
  metadata: Record<string, string>;
};

export type WalletState = {
  connected: boolean;
  handle: string | null;
  authToken: string | null;
  balance: number | null;
};

export type TextOverlay = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  letterSpacing: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  x: number;
  y: number;
  width: number;
  rotation: number;
  opacity: number;
  visible: boolean;
};

export type ImageSettings = {
  logoId: string;
  logoScale: number;
  logoPos: { x: number; y: number };
  vignetteEnabled: boolean;
  vignetteStrength: number;
  frameEnabled: boolean;
  frameThickness: number;
  frameColor: string;
  stampVisual: StampVisualSettings;
  textOverlays: TextOverlay[];
};

export type ImageItem = {
  id: string;
  name: string;
  path: string;
  url: string;
  width: number;
  height: number;
  disabled?: boolean;
  sortOrder: number;
  mediaType: 'image' | 'video' | 'audio';
  duration?: number;
  frameRate?: number;
  totalFrames?: number;
  sampleRate?: number;
  channels?: number;
  settings: ImageSettings;
};

export type ExtractedFrame = {
  id: string;
  parentId: string;
  frameIndex: number;
  timestamp: number;
  path: string;
  url: string;
  width: number;
  height: number;
  hash?: string;
};

export type AudioSegment = {
  id: string;
  parentId: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  path: string;
  label: string;
  hash?: string;
  waveformUrl?: string;
};

export type TokenisationPiece = {
  id: string;
  index: number;
  piecePath: string;
  hash: string;
  iconDataUrl: string;
  receiptId?: string;
  tokenId?: string;
  status: 'pending' | 'hashing' | 'hashed' | 'stamping' | 'stamped' | 'minting' | 'minted' | 'error';
};

export type AppMode = 'stamp' | 'mint' | 'tokenise' | 'watch' | 'mix' | 'cover' | 'titles' | 'export' | 'ticket';

// --- Watch (Video Player) types ---

export type WatchPlayback = {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  playbackRate: number;
};

// --- Mix (VJ / Video Mixer) types ---

export type MixLayer = {
  id: string;
  mediaItem: ImageItem;
  opacity: number;
  scale: number;
  visible: boolean;
  effects: MixEffects;
};

export type MixEffects = {
  jitter: number;
  strobe: number;
  impact: number;
  invertColors: boolean;
  crimsonFilter: boolean;
  crimsonStrength: number;  // 0-1
  glitch: boolean;
  glitchIntensity: number;  // 0-100
  // Extended effects
  mirror: boolean;
  kaleidoscope: boolean;
  pixelate: number;         // 0 = off, 1-32 = pixel size
  hueRotate: number;        // 0-360 degrees
  blur: number;             // 0-20 px
  feedback: number;         // 0-0.95 trail/echo amount
  scanlines: boolean;
  vhsDistort: boolean;
  rgbSplit: number;         // 0-20 px offset
  posterize: number;        // 0 = off, 2-8 levels
  // Super FX (from NPG mixer)
  ultraGlitch: boolean;
  ultraGlitchIntensity: number;   // 0-100
  realityBreak: boolean;
  realityBreakIntensity: number;  // 0-100
  dimensionShift: boolean;
  dimensionShiftMix: number;     // 0-100
  // Watch FX
  filmGrain: boolean;       // film scratches + grain
  vignette: boolean;        // radial darkening
  reverse: boolean;         // horizontal flip
  seek: boolean;            // random jump-cuts within clips
  // Color filters
  filters: Record<string, boolean>;
};

export type MixPalette = {
  id: 'a' | 'b';
  layers: MixLayer[];
};

export type MixState = {
  paletteA: MixPalette;
  paletteB: MixPalette;
  crossfader: number;
  bpm: number;
  beatSync: boolean;
  autoMix: boolean;
};

// --- Mint (Currency Designer) types ---

export type MintBlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

export type GuillocheConfig = {
  waves: number;
  frequency: number;
  amplitude: number;
  lines: number;
  strokeWidth: number;
  color: string;
  phase: number;
  damping: number;
};

export type RosetteConfig = {
  petals: number;
  rings: number;
  radius: number;
  strokeWidth: number;
  color: string;
  rotation: number;
  innerRadius: number;
};

export type FineLineConfig = {
  angle: number;
  spacing: number;
  strokeWidth: number;
  color: string;
  wave: boolean;
  waveAmplitude: number;
  waveFrequency: number;
};

export type BorderConfig = {
  style: 'classic' | 'ornate' | 'geometric' | 'art-deco';
  thickness: number;
  color: string;
  cornerStyle: 'square' | 'rounded' | 'ornament';
  innerBorder: boolean;
  innerGap: number;
};

export type MicroprintConfig = {
  text: string;
  fontSize: number;
  color: string;
  rows: number;
  angle: number;
  spacing: number;
};

export type TextLayerConfig = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  x: number;
  y: number;
};

export type ImageLayerConfig = {
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  x: number;
  y: number;
  scale: number;
};

export type SerialNumberConfig = {
  prefix: string;
  startNumber: number;
  digits: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  letterSpacing: number;
  x: number;
  y: number;
};

export type SecurityThreadConfig = {
  x: number;
  width: number;
  color: string;
  text: string;
  textColor: string;
  dashed: boolean;
  dashLength: number;
  gapLength: number;
};

export type LatheConfig = {
  lineCount: number;
  strokeWidth: number;
  color: string;
  centerX: number;
  centerY: number;
  scale: number;
  rotation: number;
};

export type GradientConfig = {
  type: 'linear' | 'radial';
  colors: string[];
  angle: number;
  opacity: number;
};

export type QRCodeConfig = {
  text: string;
  size: number;
  x: number;
  y: number;
  color: string;
  backgroundColor: string;
};

export type TextArcConfig = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  letterSpacing: number;
  radius: number;
  startAngle: number;
  centerX: number;
  centerY: number;
  flipText: boolean;
};

export type MoireConfig = {
  angle1: number;
  angle2: number;
  spacing: number;
  strokeWidth: number;
  color: string;
};

export type CrosshatchConfig = {
  angle: number;
  spacing: number;
  strokeWidth: number;
  color: string;
  sets: number;
};

export type StippleConfig = {
  density: number;
  dotSize: number;
  color: string;
  pattern: 'random' | 'halftone' | 'noise';
  seed: number;
};

export type WatermarkPatternConfig = {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  angle: number;
  spacingX: number;
  spacingY: number;
};

export type HologramConfig = {
  colors: string[];
  angle: number;
  stripWidth: number;
  shimmer: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MintLayerTransform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export type MintLayerConfig =
  | { type: 'image'; config: ImageLayerConfig }
  | { type: 'text'; config: TextLayerConfig }
  | { type: 'guilloche'; config: GuillocheConfig }
  | { type: 'rosette'; config: RosetteConfig }
  | { type: 'fine-line'; config: FineLineConfig }
  | { type: 'border'; config: BorderConfig }
  | { type: 'microprint'; config: MicroprintConfig }
  | { type: 'serial-number'; config: SerialNumberConfig }
  | { type: 'security-thread'; config: SecurityThreadConfig }
  | { type: 'lathe'; config: LatheConfig }
  | { type: 'gradient'; config: GradientConfig }
  | { type: 'qr-code'; config: QRCodeConfig }
  | { type: 'text-arc'; config: TextArcConfig }
  | { type: 'moire'; config: MoireConfig }
  | { type: 'crosshatch'; config: CrosshatchConfig }
  | { type: 'stipple'; config: StippleConfig }
  | { type: 'watermark-pattern'; config: WatermarkPatternConfig }
  | { type: 'hologram'; config: HologramConfig };

export type MintLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: MintBlendMode;
  uvOnly: boolean;
  transform: MintLayerTransform;
} & MintLayerConfig;

export type MintDocument = {
  name: string;
  description: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers: MintLayer[];
  circleMask: boolean;
  rimPattern: {
    enabled: boolean;
    teeth: number;
    depth: number;
    color: string;
  };
};

export type Spread =
  | { type: 'landscape'; image: ImageItem }
  | { type: 'portrait-pair'; left: ImageItem; right: ImageItem }
  | { type: 'portrait-solo'; image: ImageItem };

export type LogoAsset = {
  id: string;
  name: string;
  src: string;
  kind: 'builtin' | 'imported' | 'generated';
};

export type SavedImageItem = Omit<ImageItem, 'url'>;

export type ActiveIssue = {
  id: string;
  name: string;
  num: number;
  parentDir: string;
  enabledIds: Set<string>;
};
