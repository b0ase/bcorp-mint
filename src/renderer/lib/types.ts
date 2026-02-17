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
};

export type ImageItem = {
  id: string;
  name: string;
  path: string;
  url: string;
  width: number;
  height: number;
  disabled?: boolean;
  settings: ImageSettings;
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
