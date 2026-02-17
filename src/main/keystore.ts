import { app, safeStorage } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const KEYFILE = () => path.join(app.getPath('userData'), '.stamper-key');

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
