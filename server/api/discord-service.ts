import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = promisify(fs.readdir);

interface MessageAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
}

interface DiscordMessage {
  id: string;
  attachments: MessageAttachment[];
}

// 9MB chunk size for Discord uploads (Discord limit is 8MB for regular users, 50MB for nitro)
const CHUNK_SIZE = 9 * 1024 * 1024; // 9MB in bytes

export class DiscordService {
  private getDiscordApiHeaders(token: string) {
    return {
      'Authorization': token.startsWith('Bot ') ? token : `${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Creates a temporary directory for file operations
   */
  private async createTempDir(): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `discord-file-upload-${Date.now()}`);
    await mkdirAsync(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Auto-renames a file if it already exists
   */
  private autoRename(filePath: string): string {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    let counter = 1;
    let newPath = filePath;
    
    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, `${baseName}(${counter})${ext}`);
      counter++;
    }
    
    return newPath;
  }

  /**
   * Splits a file into multiple chunks of size CHUNK_SIZE
   */
  private async splitFile(filePath: string, tempDir: string): Promise<string[]> {
    const fileData = await readFileAsync(filePath);
    const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
    const chunkFiles: string[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileData.length);
      const chunkData = fileData.slice(start, end);
      
      const chunkFileName = `${path.basename(filePath)}.part${i + 1}`;
      const chunkFilePath = path.join(tempDir, chunkFileName);
      
      await writeFileAsync(chunkFilePath, chunkData);
      chunkFiles.push(chunkFilePath);
    }
    
    return chunkFiles;
  }

  /**
   * Merges file chunks back into a single file
   */
  private async mergeFiles(chunkFiles: string[], outputPath: string): Promise<string> {
    // Ensure the output path is unique
    const finalPath = this.autoRename(outputPath);
    
    // Create or truncate the output file
    fs.writeFileSync(finalPath, '');
    
    // Sort chunk files by part number
    chunkFiles.sort((a, b) => {
      const partA = parseInt(a.split('.part')[1], 10);
      const partB = parseInt(b.split('.part')[1], 10);
      return partA - partB;
    });
    
    // Append each chunk to the output file
    for (const chunkFile of chunkFiles) {
      const chunkData = await readFileAsync(chunkFile);
      fs.appendFileSync(finalPath, chunkData);
      
      // Clean up chunk file
      await unlinkAsync(chunkFile);
    }
    
    return finalPath;
  }

  /**
   * Helper method to upload a single file chunk to Discord
   */
  private async uploadChunk(channelId: string, token: string, filePath: string, originalName: string): Promise<string> {
    try {
      // Read file data
      const fileData = await readFileAsync(filePath);
      
      // Create form data
      const formData = new FormData();
      const blob = new Blob([fileData], { type: 'application/octet-stream' });
      formData.append('file', blob, path.basename(filePath));
      
      // Upload to Discord
      const response = await axios.post(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        formData,
        {
          headers: {
            'Authorization': token.startsWith('Bot ') ? token : ` ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to upload chunk ${path.basename(filePath)}`);
      }

      return response.data.id;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid Discord token');
        } else if (error.response?.status === 403) {
          throw new Error('Bot does not have permission to upload files to this channel');
        } else if (error.response?.status === 404) {
          throw new Error('Channel not found');
        } else {
          throw new Error(`Discord API error: ${error.response?.data?.message || error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Upload a file to a Discord channel
   * For files > 10MB, splits them into parts and uploads each part
   */
  async uploadFile(channelId: string, token: string, file: Express.Multer.File): Promise<string> {
    try {
      // Check if file size is greater than 10MB
      const isLargeFile = file.size > 10 * 1024 * 1024; // 10MB
      
      if (!isLargeFile) {
        // Small file - upload directly
        const formData = new FormData();
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('file', blob, file.originalname);
        
        // Upload file to Discord
        const response = await axios.post(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          formData,
          {
            headers: {
              'Authorization': token.startsWith('Bot ') ? token : `${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.status !== 200) {
          throw new Error('Failed to upload file to Discord');
        }

        return response.data.id;
      } else {
        // Large file - split and upload in chunks
        const tempDir = await this.createTempDir();
        
        // Write temporary file
        const tempFilePath = path.join(tempDir, file.originalname);
        await writeFileAsync(tempFilePath, file.buffer);
        
        // Split file into chunks
        const chunkFiles = await this.splitFile(tempFilePath, tempDir);
        
        // Upload each chunk
        const messageIds: string[] = [];
        for (const chunkFile of chunkFiles) {
          const messageId = await this.uploadChunk(channelId, token, chunkFile, file.originalname);
          messageIds.push(messageId);
          
          // Add some delay between uploads to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Clean up temporary files
        await unlinkAsync(tempFilePath);
        for (const chunkFile of chunkFiles) {
          if (fs.existsSync(chunkFile)) {
            await unlinkAsync(chunkFile);
          }
        }
        
        // Try to remove temporary directory
        try {
          fs.rmdirSync(tempDir);
        } catch (error) {
          console.warn('Could not remove temporary directory:', error);
        }
        
        // Return the first message ID
        return messageIds[0];
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid Discord token');
        } else if (error.response?.status === 403) {
          throw new Error('Bot does not have permission to upload files to this channel');
        } else if (error.response?.status === 404) {
          throw new Error('Channel not found');
        } else {
          throw new Error(`Discord API error: ${error.response?.data?.message || error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Finds all file parts in a channel for a large file
   * @param channelId Discord channel ID
   * @param token Discord bot token
   * @param filename Base filename to search for
   * @returns Array of file parts with their URLs
   */
  private async findFileParts(channelId: string, token: string, filename: string): Promise<MessageAttachment[]> {
    // Get messages from the channel
    const response = await axios.get(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
      {
        headers: this.getDiscordApiHeaders(token),
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to fetch messages from Discord');
    }

    const messages: DiscordMessage[] = response.data;
    const fileParts: MessageAttachment[] = [];

    // Find all file parts that match the pattern filename.partX
    for (const message of messages) {
      for (const attachment of message.attachments) {
        if (attachment.filename.startsWith(`${filename}.part`)) {
          fileParts.push(attachment);
        }
      }
    }

    if (fileParts.length === 0) {
      throw new Error(`No file parts found for "${filename}"`);
    }

    // Sort parts by part number
    fileParts.sort((a, b) => {
      const partA = parseInt(a.filename.split('.part')[1], 10);
      const partB = parseInt(b.filename.split('.part')[1], 10);
      return partA - partB;
    });

    return fileParts;
  }

  /**
   * Download a file from a Discord channel
   * For large files, downloads and combines all parts
   */
  async downloadFile(channelId: string, token: string, filename: string, isLarge: boolean): Promise<Buffer> {
    try {
      if (!isLarge) {
        // Regular file download
        // Retrieve the messages in the channel to find the file
        const response = await axios.get(
          `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
          {
            headers: this.getDiscordApiHeaders(token),
          }
        );

        if (response.status !== 200) {
          throw new Error('Failed to fetch messages from Discord');
        }

        // Find the message with the requested file
        const messages: DiscordMessage[] = response.data;
        let fileUrl: string | null = null;

        for (const message of messages) {
          for (const attachment of message.attachments) {
            if (attachment.filename === filename) {
              fileUrl = attachment.url;
              break;
            }
          }
          if (fileUrl) break;
        }

        if (!fileUrl) {
          throw new Error(`File "${filename}" not found in the channel`);
        }

        // Download the file
        const fileResponse = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
        });

        if (fileResponse.status !== 200) {
          throw new Error('Failed to download file from Discord');
        }

        return Buffer.from(fileResponse.data);
      } else {
        // Large file download - need to find and combine parts
        const tempDir = await this.createTempDir();
        const outputPath = path.join(tempDir, filename);
        const fileParts = await this.findFileParts(channelId, token, filename);
        
        // Download each part
        const downloadedParts: string[] = [];
        for (const part of fileParts) {
          const partPath = path.join(tempDir, part.filename);
          
          // Download the part
          const fileResponse = await axios.get(part.url, {
            responseType: 'arraybuffer',
          });
          
          if (fileResponse.status !== 200) {
            throw new Error(`Failed to download part ${part.filename}`);
          }
          
          // Save the part
          await writeFileAsync(partPath, Buffer.from(fileResponse.data));
          downloadedParts.push(partPath);
        }
        
        // Merge the parts
        const mergedFilePath = await this.mergeFiles(downloadedParts, outputPath);
        
        // Read the merged file
        const fileData = await readFileAsync(mergedFilePath);
        
        // Clean up
        await unlinkAsync(mergedFilePath);
        try {
          fs.rmdirSync(tempDir);
        } catch (error) {
          console.warn('Could not remove temporary directory:', error);
        }
        
        return fileData;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid Discord token');
        } else if (error.response?.status === 403) {
          throw new Error('Bot does not have permission to access this channel');
        } else if (error.response?.status === 404) {
          throw new Error('Channel not found');
        } else {
          throw new Error(`Discord API error: ${error.response?.data?.message || error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Find file messages in a Discord channel
   */
  async findFileMessages(channelId: string, token: string): Promise<MessageAttachment[]> {
    try {
      const response = await axios.get(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        {
          headers: this.getDiscordApiHeaders(token),
        }
      );

      if (response.status !== 200) {
        throw new Error('Failed to fetch messages from Discord');
      }

      const messages: DiscordMessage[] = response.data;
      const attachments: MessageAttachment[] = [];

      for (const message of messages) {
        if (message.attachments.length > 0) {
          attachments.push(...message.attachments);
        }
      }

      return attachments;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid Discord token');
        } else if (error.response?.status === 403) {
          throw new Error('Bot does not have permission to access this channel');
        } else if (error.response?.status === 404) {
          throw new Error('Channel not found');
        } else {
          throw new Error(`Discord API error: ${error.response?.data?.message || error.message}`);
        }
      }
      throw error;
    }
  }
}

export const discordService = new DiscordService();
