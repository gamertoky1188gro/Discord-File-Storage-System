import crypto from 'crypto';

/**
 * Service for securely managing credentials like Discord tokens
 */
export class CredentialService {
  /**
   * Securely hash a token for storage
   * @param token Raw token to hash
   * @returns Hashed token suitable for storage
   */
  hashToken(token: string): string {
    // Use a secure hashing algorithm (SHA-256)
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify if a provided token matches a stored hash
   * @param token Raw token to verify
   * @param storedHash Stored hash to compare against
   * @returns True if token matches the hash
   */
  verifyToken(token: string, storedHash: string): boolean {
    const hashedToken = this.hashToken(token);
    return hashedToken === storedHash;
  }

  /**
   * Generate a secure encryption key
   * @returns Object containing key and salt
   */
  generateEncryptionKey(): { key: Buffer, salt: Buffer } {
    // Generate a random salt
    const salt = crypto.randomBytes(16);
    // Generate a secure key using PBKDF2
    const key = crypto.pbkdf2Sync('secure-passphrase', salt, 100000, 32, 'sha256');
    
    return { key, salt };
  }

  /**
   * Hash an encryption key for storage
   * @param key Encryption key to hash
   * @returns Hashed key suitable for storage
   */
  hashEncryptionKey(key: Buffer): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data Data to encrypt
   * @param key Encryption key
   * @returns Encrypted data with IV and auth tag
   */
  encryptData(data: Buffer, key: Buffer): { encrypted: Buffer, iv: Buffer, authTag: Buffer } {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    return { encrypted, iv, authTag };
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encrypted Encrypted data
   * @param key Decryption key
   * @param iv Initialization vector used for encryption
   * @param authTag Authentication tag
   * @returns Decrypted data
   */
  decryptData(encrypted: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    
    // Set authentication tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }
}

export const credentialService = new CredentialService();