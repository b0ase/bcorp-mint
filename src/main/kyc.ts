/**
 * Veriff KYC + BRC-KYC-Certificate issuance.
 *
 * Ported from bMovies (api/kyc-start.ts, api/kyc-webhook.ts, src/kyc/certificate.ts).
 * Adapted for Electron/local-first privacy:
 *
 *   - No database. Session and certificate are stored as JSON files in
 *     userData/kyc/ (mode 0o600).
 *   - No webhook endpoint (Electron can't receive them). We poll
 *     Veriff's GET /v1/sessions/{id}/decision after the user finishes.
 *   - The BRC-KYC-Certificate itself is identical to the bMovies one —
 *     BSM-signed JSON, deterministic signing key, publicly verifiable.
 *
 * Cert flow:
 *   1. startSession(email, subjectAddress) → opens Veriff hosted URL
 *      in system browser, stores session.json locally.
 *   2. User completes the Veriff check. The hosted page redirects back.
 *   3. pollDecision(sessionId) polls Veriff until status=approved.
 *   4. On approval we BSM-sign a BRC-KYC-Certificate locally and write
 *      certificate.json. The user can then attach the certificate to
 *      BTMS issuance metadata.
 *
 * NOTE: this module deliberately does not send ANY PII anywhere. The
 * certificate only contains the subject address + issuer signature —
 * no name, DOB, or document data. Those fields stay at Veriff.
 */

import { createHmac, randomBytes } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { app, shell } from 'electron';
import { PrivateKey, PublicKey, BSM, Signature } from '@bsv/sdk';

const VERIFF_API_URL = process.env.VERIFF_API_URL || 'https://stationapi.veriff.com/v1/sessions';
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 min — user has to finish KYC in this window

// --- Types ---

export interface BrcKycCertificate {
  type: 'BRC-KYC-Certificate';
  version: '1.0';
  issuer: string;
  issuerPublicKey: string;
  issuerAddress: string;
  subject: string;
  kycProvider: 'Veriff OÜ';
  kycLevel: 'document + biometric';
  status: 'verified';
  verifiedAt: string;
  protocolID: [number, string];
  keyID: string;
  issuedAt: string;
}

export interface StoredSession {
  veriffSessionId: string;
  sessionUrl: string;
  subjectAddress: string;
  vendorData: string;
  status: 'created' | 'submitted' | 'approved' | 'declined' | 'abandoned' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface StoredCertificate {
  certificate: BrcKycCertificate;
  signature: string;
  publicKey: string;
  savedAt: string;
}

// --- Paths ---

const kycDir = (): string => path.join(app.getPath('userData'), 'kyc');
const sessionPath = (): string => path.join(kycDir(), 'session.json');
const certPath = (): string => path.join(kycDir(), 'certificate.json');
const signerSecretPath = (): string => path.join(kycDir(), 'signer.secret');

async function ensureKycDir(): Promise<void> {
  await fs.mkdir(kycDir(), { recursive: true });
}

// --- Signing key (deterministic) ---

/**
 * Derive a deterministic BSM signing key from a secret. Same pattern as
 * bMovies/src/kyc/certificate.ts. The secret is either:
 *   - process.env.KYC_CERT_SIGNING_SECRET, or
 *   - a locally-generated secret in userData/kyc/signer.secret (0o600).
 *
 * Using a deterministic key means the same Mint install always issues
 * certificates under the same public key — users can publish it once
 * and downstream verifiers can cache it.
 */
async function getSigningSecret(): Promise<string> {
  const envSecret = process.env.KYC_CERT_SIGNING_SECRET?.trim();
  if (envSecret) return envSecret;

  await ensureKycDir();
  try {
    const existing = await fs.readFile(signerSecretPath(), 'utf-8');
    if (existing.trim().length >= 32) return existing.trim();
  } catch {
    // fall through
  }

  const generated = randomBytes(32).toString('hex');
  await fs.writeFile(signerSecretPath(), generated, { encoding: 'utf-8', mode: 0o600 });
  return generated;
}

async function getSigningKey(): Promise<{
  privateKey: PrivateKey;
  publicKey: string;
  address: string;
}> {
  const secret = await getSigningSecret();
  const hmac = createHmac('sha256', secret);
  hmac.update('bcorp-mint-kyc-cert-signer');
  const seed = hmac.digest('hex');
  const privateKey = PrivateKey.fromString(seed, 'hex');
  const publicKey = privateKey.toPublicKey().toString();
  const address = privateKey.toAddress();
  return { privateKey, publicKey, address };
}

// --- Certificate creation and signing ---

function buildCertificate(
  subjectAddress: string,
  verifiedAt: string,
  signingPublicKey: string,
  signingAddress: string
): BrcKycCertificate {
  return {
    type: 'BRC-KYC-Certificate',
    version: '1.0',
    issuer: 'The Bitcoin Corporation Mint',
    issuerPublicKey: signingPublicKey,
    issuerAddress: signingAddress,
    subject: subjectAddress,
    kycProvider: 'Veriff OÜ',
    kycLevel: 'document + biometric',
    status: 'verified',
    verifiedAt,
    protocolID: [1, 'bcorp-mint-kyc'],
    keyID: 'kyc-cert-1',
    issuedAt: new Date().toISOString(),
  };
}

function signBsm(cert: BrcKycCertificate, privateKey: PrivateKey): string {
  const message = JSON.stringify(cert);
  const messageBytes = Array.from(Buffer.from(message, 'utf-8'));
  const sig = BSM.sign(messageBytes, privateKey, 'raw') as unknown as Signature;
  return Buffer.from(sig.toDER()).toString('hex');
}

export function verifyCertificate(
  certJson: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const messageBytes = Array.from(Buffer.from(certJson, 'utf-8'));
    const derBytes = Array.from(Buffer.from(signatureHex, 'hex'));
    const sig = Signature.fromDER(derBytes);
    const pubKey = PublicKey.fromString(publicKeyHex);
    return BSM.verify(messageBytes, sig, pubKey);
  } catch {
    return false;
  }
}

// --- Veriff API ---

interface VeriffSessionResponse {
  verification?: {
    id?: string;
    url?: string;
    status?: string;
  };
}

interface VeriffDecisionResponse {
  verification?: {
    id?: string;
    status?: string; // approved | declined | resubmission_requested | ...
    decisionTime?: string;
  };
  status?: string;
}

async function createVeriffSession(
  vendorData: string,
  callbackUrl: string
): Promise<{ url: string; sessionId: string }> {
  const apiKey = process.env.VERIFF_API_KEY;
  if (!apiKey) {
    throw new Error('VERIFF_API_KEY is not set. Configure it in .env.local');
  }

  const res = await fetch(VERIFF_API_URL, {
    method: 'POST',
    headers: {
      'X-AUTH-CLIENT': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verification: {
        callback: callbackUrl,
        vendorData,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veriff ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as VeriffSessionResponse;
  const url = data.verification?.url;
  const id = data.verification?.id;
  if (!url || !id) {
    throw new Error('Veriff response missing verification.url or verification.id');
  }
  return { url, sessionId: id };
}

async function getVeriffDecision(sessionId: string): Promise<string | null> {
  const apiKey = process.env.VERIFF_API_KEY;
  if (!apiKey) throw new Error('VERIFF_API_KEY not set');

  const res = await fetch(`https://stationapi.veriff.com/v1/sessions/${sessionId}/decision`, {
    method: 'GET',
    headers: { 'X-AUTH-CLIENT': apiKey },
  });

  // 404 means no decision yet
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veriff decision fetch failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as VeriffDecisionResponse;
  return data.verification?.status || data.status || null;
}

// --- Public API ---

/**
 * Start a Veriff session and open the hosted KYC page in the system
 * browser. Persists a session.json so the renderer can reconnect.
 */
export async function startSession(input: {
  subjectAddress: string;
  email?: string;
}): Promise<StoredSession> {
  await ensureKycDir();
  const vendorData = input.email ?? `subject:${input.subjectAddress}`;
  // Callback is where the Veriff hosted page returns the user. For the
  // Electron flow this is cosmetic — we poll for the decision regardless.
  const callbackUrl = 'https://bitcoin.mint/kyc/callback';
  const { url, sessionId } = await createVeriffSession(vendorData, callbackUrl);

  const session: StoredSession = {
    veriffSessionId: sessionId,
    sessionUrl: url,
    subjectAddress: input.subjectAddress,
    vendorData,
    status: 'submitted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(sessionPath(), JSON.stringify(session, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  // Open the Veriff hosted page in the user's browser
  await shell.openExternal(url);

  return session;
}

/**
 * Load the stored session, if any.
 */
export async function getStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await fs.readFile(sessionPath(), 'utf-8');
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Load the stored certificate, if any.
 */
export async function getStoredCertificate(): Promise<StoredCertificate | null> {
  try {
    const raw = await fs.readFile(certPath(), 'utf-8');
    return JSON.parse(raw) as StoredCertificate;
  } catch {
    return null;
  }
}

/**
 * Poll Veriff for the session decision. If approved, issue and persist
 * the BRC-KYC-Certificate. Returns the final decision status.
 *
 * This function returns quickly if a cert already exists for the same
 * subject (idempotent).
 */
export async function pollDecisionAndIssue(sessionId: string): Promise<{
  status: string;
  certificate?: StoredCertificate;
}> {
  const session = await getStoredSession();
  if (!session || session.veriffSessionId !== sessionId) {
    throw new Error('No matching Veriff session on disk');
  }

  const existing = await getStoredCertificate();
  if (existing && existing.certificate.subject === session.subjectAddress) {
    return { status: 'approved', certificate: existing };
  }

  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const status = await getVeriffDecision(sessionId);
    if (status === 'approved') {
      const cert = await issueCertificate(session.subjectAddress);
      session.status = 'approved';
      session.updatedAt = new Date().toISOString();
      await fs.writeFile(sessionPath(), JSON.stringify(session, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
      return { status: 'approved', certificate: cert };
    }
    if (status === 'declined' || status === 'expired') {
      session.status = status;
      session.updatedAt = new Date().toISOString();
      await fs.writeFile(sessionPath(), JSON.stringify(session, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
      return { status };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('KYC polling timed out after 30 minutes');
}

/**
 * Issue and persist a BRC-KYC-Certificate for the given subject.
 * Called once Veriff returns 'approved'.
 */
export async function issueCertificate(subjectAddress: string): Promise<StoredCertificate> {
  await ensureKycDir();
  const { privateKey, publicKey, address: signerAddress } = await getSigningKey();
  const verifiedAt = new Date().toISOString();
  const cert = buildCertificate(subjectAddress, verifiedAt, publicKey, signerAddress);
  const signature = signBsm(cert, privateKey);

  const stored: StoredCertificate = {
    certificate: cert,
    signature,
    publicKey,
    savedAt: new Date().toISOString(),
  };
  await fs.writeFile(certPath(), JSON.stringify(stored, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  return stored;
}

/**
 * Verify a certificate provided by any caller. This is symmetrical to
 * the public /api/kyc/verify-cert endpoint in bMovies — it has no side
 * effects and no privileged data. Useful so any party can confirm a
 * certificate attached to an issuance metadata was truly signed by
 * this Mint install.
 */
export function verifyCertificatePair(
  certJson: string,
  signatureHex: string
): { valid: boolean; certificate?: BrcKycCertificate; error?: string } {
  try {
    const parsed = JSON.parse(certJson) as Record<string, unknown>;
    const typ = parsed.type as string | undefined;
    if (typ !== 'BRC-KYC-Certificate') {
      return { valid: false, error: `Unsupported type: ${typ}` };
    }
    const pk = parsed.issuerPublicKey as string | undefined;
    if (!pk) return { valid: false, error: 'Missing issuerPublicKey' };
    const valid = verifyCertificate(certJson, signatureHex, pk);
    return valid
      ? { valid: true, certificate: parsed as unknown as BrcKycCertificate }
      : { valid: false, error: 'Signature verification failed' };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Forget everything. Deletes session.json and certificate.json.
 * signer.secret is preserved so reissued certs keep the same issuer key.
 */
export async function resetKyc(): Promise<void> {
  await fs.rm(sessionPath(), { force: true });
  await fs.rm(certPath(), { force: true });
}
