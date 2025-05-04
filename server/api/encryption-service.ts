import crypto from 'crypto';
import { storage } from '../storage';
import { credentialService } from './credential-service';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Service for handling file encryption and decryption
 */
export class EncryptionService {
  /**
   * Generate a temporary directory for file operations
   * @returns Path to created temp directory
   */
  private async createTempDir(): Promise<string> {
    const tempDirPath = path.join(os.tmpdir(), 'discord-storage-' + crypto.randomBytes(8).toString('hex'));
    await fs.promises.mkdir(tempDirPath, { recursive: true });
    return tempDirPath;
  }
  
  /**
   * Encrypt a file
   * @param filePath Path to the file to encrypt
   * @param password User-provided password
   * @returns Object with encrypted file path and encryption details
   */
  async encryptFile(filePath: string, password: string): Promise<{
    encryptedFilePath: string;
    salt: Buffer;
    iv: Buffer;
    authTag: Buffer;
  }> {
    // Create a temporary directory for the encrypted file
    const tempDir = await this.createTempDir();
    
    // Generate a key from the password
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Read the file
    const fileContent = await fs.promises.readFile(filePath);
    
    // Encrypt the file
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt file content
    const encryptedContent = Buffer.concat([
      cipher.update(fileContent),
      cipher.final()
    ]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Save encrypted file
    const encryptedFilePath = path.join(tempDir, path.basename(filePath) + '.encrypted');
    await fs.promises.writeFile(encryptedFilePath, encryptedContent);
    
    return {
      encryptedFilePath,
      salt,
      iv,
      authTag
    };
  }
  
  /**
   * Decrypt a file
   * @param encryptedFilePath Path to encrypted file
   * @param outputPath Path to save decrypted file
   * @param password User-provided password
   * @param salt Salt used in encryption
   * @param iv Initialization vector used in encryption
   * @param authTag Authentication tag from encryption
   * @returns Path to decrypted file
   */
  async decryptFile(
    encryptedFilePath: string,
    outputPath: string,
    password: string,
    salt: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): Promise<string> {
    // Generate key from password and salt
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Read encrypted file
    const encryptedContent = await fs.promises.readFile(encryptedFilePath);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt file
    const decryptedContent = Buffer.concat([
      decipher.update(encryptedContent),
      decipher.final()
    ]);
    
    // Write decrypted file
    await fs.promises.writeFile(outputPath, decryptedContent);
    
    return outputPath;
  }
  
  /**
   * Store encryption details for a file
   * @param fileId File ID
   * @param password User-provided password
   * @param salt Salt used in encryption
   * @returns Stored encryption key record
   */
  async storeEncryptionDetails(fileId: number, password: string, salt: Buffer): Promise<any> {
    // Generate a key from the password and salt
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Hash the key for storage
    const keyHash = credentialService.hashEncryptionKey(key);
    
    // Store the encryption details
    return storage.createFileEncryptionKey({
      file_id: fileId,
      key_hash: keyHash,
      salt: salt.toString('hex'),
      algorithm: 'aes-256-gcm'
    });
  }
  
  /**
   * Get encryption details for a file
   * @param fileId File ID
   * @returns Encryption details if available
   */
  async getEncryptionDetails(fileId: number) {
    return storage.getFileEncryptionKey(fileId);
  }
}

export const encryptionService = new EncryptionService();