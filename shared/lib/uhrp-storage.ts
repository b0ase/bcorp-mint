/**
 * UHRP (Universal Hash Resolution Protocol, BRC-26) Storage Client
 *
 * Content-addressed storage on BSV. Hosts advertise file availability
 * via on-chain UTXOs. Uses nanostore.babbage.systems as the reference
 * UHRP storage server.
 */

const NANOSTORE_URL = 'https://nanostore.babbage.systems';

export interface UHRPUploadResult {
  uhrpUrl: string;
  hash: string;
  publicUrl: string;
}

/**
 * Get a cost estimate for uploading a file of given size.
 * Returns cost in satoshis.
 */
export async function estimateUploadCost(
  fileSizeBytes: number,
  retentionPeriod: 'permanent' | '1year' | '5years' = 'permanent'
): Promise<{ satoshis: number; usd: string }> {
  try {
    const res = await fetch(`${NANOSTORE_URL}/api/v1/price?size=${fileSizeBytes}&retention=${retentionPeriod}`);
    if (!res.ok) {
      // Fallback estimate: ~1 sat per 100 bytes + base fee
      const estimated = Math.ceil(fileSizeBytes / 100) + 500;
      return { satoshis: estimated, usd: (estimated * 0.00003).toFixed(4) };
    }
    const data = await res.json();
    return { satoshis: data.satoshis ?? data.price, usd: data.usd ?? (data.satoshis * 0.00003).toFixed(4) };
  } catch {
    const estimated = Math.ceil(fileSizeBytes / 100) + 500;
    return { satoshis: estimated, usd: (estimated * 0.00003).toFixed(4) };
  }
}

/**
 * Upload encrypted data to UHRP storage.
 * Returns the content-addressed UHRP URL and transaction details.
 */
export async function uploadToUHRP(
  data: Uint8Array,
  filename: string,
  contentType: string = 'application/octet-stream'
): Promise<UHRPUploadResult> {
  const formData = new FormData();
  const blob = new Blob([data.buffer as ArrayBuffer], { type: contentType });
  formData.append('file', blob, filename);

  const res = await fetch(`${NANOSTORE_URL}/api/v1/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`UHRP upload failed (${res.status}): ${text}`);
  }

  const result = await res.json();
  return {
    uhrpUrl: result.uhrpUrl || result.url || `uhrp://${result.hash}`,
    hash: result.hash,
    publicUrl: result.publicUrl || result.url || '',
  };
}

/**
 * Download content from a UHRP URL.
 * Resolves the content-addressed URL and returns the raw bytes.
 */
export async function downloadFromUHRP(uhrpUrl: string): Promise<Uint8Array> {
  // Extract hash from uhrp:// URL
  const hash = uhrpUrl.replace(/^uhrp:\/\//, '');

  const res = await fetch(`${NANOSTORE_URL}/api/v1/download/${hash}`);
  if (!res.ok) {
    throw new Error(`UHRP download failed (${res.status})`);
  }

  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}
