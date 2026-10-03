/**
 * bApp login constants shared by the browser (signs) and the server (verifies).
 * Server-safe: no React, no DOM. See bapp-standard SPEC.md section 3.3.
 */

export type ProtocolID = [0 | 1 | 2, string];

/** Protocol and key the login signature is made under. */
export const LOGIN_PROTOCOL: ProtocolID = [2, 'bapp login'];
export const LOGIN_KEY_ID = '1';

/** The exact string that is signed. Both sides rebuild it from the nonce and the origin. */
export function loginMessage(nonce: string, origin: string): string {
  return `bapp login|v1|origin=${origin}|nonce=${nonce}`;
}

/** 33-byte compressed public key, hex. */
export const IDENTITY_KEY_RE = /^0[23][0-9a-fA-F]{64}$/;
