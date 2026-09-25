/**
 * KYC — local certificate issuance is PAUSED.
 *
 * The previous implementation called Veriff from inside the desktop app
 * (with a VERIFF_API_KEY read from the local environment) and BSM-signed
 * "BRC-KYC-Certificates" with a key derived from a per-install secret.
 * That made every install its own certifier, so the certificates proved
 * nothing, and it required a Veriff API key to live on end-user machines.
 *
 * Identity verification now happens in bChat (https://bit-sign.online),
 * which runs Veriff server-side and issues certificates under bit-sign's
 * published root keys (/.well-known/bit-sign-root-keys.json). The Mint
 * no longer issues, stores, or trusts locally-signed KYC certificates.
 *
 * Follow-up: when the Mint needs a KYC status (e.g. if securities issuance
 * is re-enabled), query bit-sign's /api/identity/verify?pubkey&policy with
 * a Mint-specific policy and verify the returned cert against bit-sign's
 * root keys. No such policy exists yet.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { app, shell } from 'electron';

export const BIT_SIGN_URL = 'https://bit-sign.online';

export const KYC_MOVED_MESSAGE =
  'Identity verification happens in bChat (bit-sign.online). ' +
  'The Mint no longer issues KYC certificates locally.';

/** Open bit-sign.online in the user's browser to verify identity there. */
export async function openBitSignVerification(): Promise<boolean> {
  await shell.openExternal(BIT_SIGN_URL);
  return true;
}

/**
 * Delete any legacy local KYC state left by earlier versions: the Veriff
 * session file, the self-signed certificate, and the local signer secret.
 */
export async function resetKyc(): Promise<void> {
  const dir = path.join(app.getPath('userData'), 'kyc');
  await fs.rm(dir, { recursive: true, force: true });
}
