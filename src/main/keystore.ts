import { app, safeStorage } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { PrivateKey } from '@bsv/sdk';

const KEYFILE = () => path.join(app.getPath('userData'), '.stamper-key');
const MASTER_KEYFILE = () => path.join(app.getPath('userData'), '.master-key');

// --- Legacy single-key functions (backward compat) ---

export async function hasPrivateKey(): Promise<boolean> {
  try {
    await fs.access(KEYFILE());
    return true;
  } catch {
    return false;
  }
}

export async function savePrivateKey(wif: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain encryption not available');
  }
  const encrypted = safeStorage.encryptString(wif);
  await fs.writeFile(KEYFILE(), encrypted);
}

export async function loadPrivateKey(): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain encryption not available');
  }
  const encrypted = await fs.readFile(KEYFILE());
  return safeStorage.decryptString(encrypted);
}

export async function deletePrivateKey(): Promise<void> {
  try {
    await fs.unlink(KEYFILE());
  } catch {
    // Already deleted
  }
}

// --- Master key functions (HD wallet) ---

export async function hasMasterKey(): Promise<boolean> {
  try {
    await fs.access(MASTER_KEYFILE());
    return true;
  } catch {
    return false;
  }
}

export async function saveMasterKey(hex: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain encryption not available');
  }
  const encrypted = safeStorage.encryptString(hex);
  await fs.writeFile(MASTER_KEYFILE(), encrypted);
}

export async function loadMasterKey(): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain encryption not available');
  }
  const encrypted = await fs.readFile(MASTER_KEYFILE());
  return safeStorage.decryptString(encrypted);
}

export async function deleteMasterKey(): Promise<void> {
  try {
    await fs.unlink(MASTER_KEYFILE());
  } catch {
    // Already deleted
  }
}

/**
 * Migration: if .stamper-key exists but .master-key doesn't,
 * promote the existing WIF to master key (convert WIF → hex).
 * Returns true if migration occurred.
 */
export async function migrateLegacyKey(): Promise<boolean> {
  const hasLegacy = await hasPrivateKey();
  const hasMaster = await hasMasterKey();

  if (hasLegacy && !hasMaster) {
    const wif = await loadPrivateKey();
    const privateKey = PrivateKey.fromWif(wif);
    await saveMasterKey(privateKey.toHex());
    return true;
  }
  return false;
}

/**
 * Export master key backup encrypted with user password.
 * Uses AES-256-GCM with scrypt-derived key.
 * Returns base64-encoded encrypted payload.
 */
export async function exportMasterKeyBackup(password: string): Promise<string> {
  const masterHex = await loadMasterKey();

  const salt = randomBytes(32);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(masterHex, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: salt(32) + iv(12) + authTag(16) + ciphertext
  const payload = Buffer.concat([salt, iv, authTag, encrypted]);
  return payload.toString('base64');
}

/**
 * Import master key backup. Decrypts with password, returns hex.
 */
export function importMasterKeyBackup(data: string, password: string): string {
  const payload = Buffer.from(data, 'base64');

  const salt = payload.subarray(0, 32);
  const iv = payload.subarray(32, 44);
  const authTag = payload.subarray(44, 60);
  const encrypted = payload.subarray(60);

  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}
