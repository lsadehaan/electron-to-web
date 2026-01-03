/**
 * SafeStorage API shim
 * Maps Electron's safeStorage API to a basic encryption implementation
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/safe-storage
 *
 * Note: This is a simplified implementation for web context.
 * In production, use proper encryption libraries.
 */

import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'electron-to-web-default-key-change-in-production';

export class SafeStorage {
  /**
   * Check if encryption is available
   * Always true in Node.js environment
   */
  isEncryptionAvailable(): boolean {
    return true;
  }

  /**
   * Encrypt a string
   */
  encryptString(plainText: string): Buffer {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Prepend IV to encrypted data
    return Buffer.from(iv.toString('hex') + ':' + encrypted, 'utf8');
  }

  /**
   * Decrypt a buffer
   */
  decryptString(encrypted: Buffer): string {
    const textParts = encrypted.toString('utf8').split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');

    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// Singleton instance
export const safeStorage = new SafeStorage();
