// ---------------------------------------------------------------------------
// QR Code Standalone Mode — Types
// ---------------------------------------------------------------------------

export type QRContentType = 'url' | 'text' | 'wallet' | 'token' | 'vcard' | 'wifi' | 'email';

export type QRModuleStyle = 'square' | 'rounded' | 'dots' | 'diamond';
export type QRFinderStyle = 'standard' | 'rounded' | 'circle';
export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export type QRStyle = {
  foreground: string;
  background: string;
  moduleStyle: QRModuleStyle;
  finderStyle: QRFinderStyle;
};

export type QRLogoConfig = {
  src: string;
  size: number;       // 0.05–0.30 of QR area
  padShape: 'circle' | 'square';
  padColor: string;
};

export type QRBatchConfig = {
  enabled: boolean;
  mode: 'serial' | 'csv';
  prefix: string;
  start: number;
  end: number;
  csvRows: string[];
};

export type QRProject = {
  contentType: QRContentType;
  content: Record<string, string>;
  style: QRStyle;
  logo: QRLogoConfig | null;
  size: number;        // 256–2048
  margin: number;      // 0–8 modules
  errorCorrection: QRErrorCorrection;
  batch: QRBatchConfig;
};

export const QR_CONTENT_LABELS: Record<QRContentType, string> = {
  url: 'URL',
  text: 'Plain Text',
  wallet: 'Wallet Address',
  token: 'Token Metadata',
  vcard: 'vCard',
  wifi: 'WiFi',
  email: 'Email',
};

export const QR_CONTENT_FIELDS: Record<QRContentType, { key: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[]> = {
  url: [
    { key: 'url', label: 'URL', type: 'text' },
  ],
  text: [
    { key: 'text', label: 'Text', type: 'textarea' },
  ],
  wallet: [
    { key: 'address', label: 'Address', type: 'text' },
  ],
  token: [
    { key: 'symbol', label: 'Symbol', type: 'text' },
    { key: 'supply', label: 'Supply', type: 'text' },
    { key: 'protocol', label: 'Protocol', type: 'select', options: ['BSV-20', 'BSV-21'] },
    { key: 'address', label: 'Address', type: 'text' },
  ],
  vcard: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'org', label: 'Organisation', type: 'text' },
  ],
  wifi: [
    { key: 'ssid', label: 'SSID', type: 'text' },
    { key: 'password', label: 'Password', type: 'text' },
    { key: 'encryption', label: 'Encryption', type: 'select', options: ['WPA', 'WEP', 'nopass'] },
  ],
  email: [
    { key: 'address', label: 'Email Address', type: 'text' },
    { key: 'subject', label: 'Subject', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
};

export function defaultQRProject(): QRProject {
  return {
    contentType: 'url',
    content: { url: '' },
    style: {
      foreground: '#ffffff',
      background: 'transparent',
      moduleStyle: 'square',
      finderStyle: 'standard',
    },
    logo: null,
    size: 512,
    margin: 4,
    errorCorrection: 'M',
    batch: {
      enabled: false,
      mode: 'serial',
      prefix: 'QR-',
      start: 1,
      end: 10,
      csvRows: [],
    },
  };
}

export function buildDataString(contentType: QRContentType, content: Record<string, string>): string {
  switch (contentType) {
    case 'url':
      return content.url || '';
    case 'text':
      return content.text || '';
    case 'wallet':
      return content.address ? `bitcoin:${content.address}` : '';
    case 'token':
      return JSON.stringify({
        p: content.protocol || 'BSV-20',
        op: 'deploy',
        tick: content.symbol || '',
        max: content.supply || '',
        addr: content.address || '',
      });
    case 'vcard': {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      if (content.name) lines.push(`FN:${content.name}`);
      if (content.email) lines.push(`EMAIL:${content.email}`);
      if (content.phone) lines.push(`TEL:${content.phone}`);
      if (content.org) lines.push(`ORG:${content.org}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    case 'wifi':
      return `WIFI:T:${content.encryption || 'WPA'};S:${content.ssid || ''};P:${content.password || ''};;`;
    case 'email': {
      let uri = `mailto:${content.address || ''}`;
      const params: string[] = [];
      if (content.subject) params.push(`subject=${encodeURIComponent(content.subject)}`);
      if (content.body) params.push(`body=${encodeURIComponent(content.body)}`);
      if (params.length) uri += '?' + params.join('&');
      return uri;
    }
    default:
      return '';
  }
}
