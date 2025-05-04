import { storage } from '../storage';
import { discordService } from './discord-service';
import { profileService } from './profile-service';
import { WebSocket } from 'ws';

/**
 * Service for managing batch file operations
 */
export class BatchService {
  private clients: Map<string, WebSocket> = new Map();
  
  /**
   * Register a client for notifications
   * @param userId User ID
   * @param ws WebSocket connection
   */
  registerClient(userId: string, ws: WebSocket) {
    this.clients.set(userId, ws);
  }
  
  /**
   * Unregister a client
   * @param userId User ID
   */
  unregisterClient(userId: string) {
    this.clients.delete(userId);
  }
  
  /**
   * Send a notification to a client
   * @param userId User ID
   * @param message Message to send
   */
  notifyClient(userId: string, message: any) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
  
  /**
   * Create a new batch upload operation
   * @param userId User ID
   * @param files Files to upload
   * @param channelId Discord channel ID
   * @param token Discord token
   * @returns Created batch operation
   */
  async createBatchUpload(userId: number, files: Express.Multer.File[], channelId: string, token: string) {
    // Create the batch operation
    const batchOp = await storage.createBatchOperation({
      user_id: userId,
      operation_type: 'upload',
      status: 'pending',
      total_files: files.length,
    });
    
    // Process the batch in the background
    this.processBatchUpload(batchOp.id, userId, files, channelId, token);
    
    return batchOp;
  }
  
  /**
   * Process a batch upload operation
   * @param batchId Batch operation ID
   * @param userId User ID
   * @param files Files to upload
   * @param channelId Discord channel ID
   * @param token Discord token
   */
  private async processBatchUpload(
    batchId: number,
    userId: number,
    files: Express.Multer.File[],
    channelId: string,
    token: string
  ) {
    // Update batch status
    await storage.updateBatchOperation(batchId, { status: 'in_progress' });
    
    // Get channel
    let channel = await storage.getChannelByDiscordId(channelId);
    if (!channel) {
      channel = await storage.createChannel({
        discord_channel_id: channelId,
        name: `Channel ${channelId}`
      });
    }
    
    // Process each file
    let completedFiles = 0;
    
    for (const file of files) {
      try {
        // Notify progress
        this.notifyClient(userId.toString(), {
          type: 'batch_progress',
          batchId,
          total: files.length,
          completed: completedFiles,
          current: file.originalname
        });
        
        // Create file record
        const fileRecord = await storage.createFile({
          filename: file.originalname,
          original_filename: file.originalname,
          size_bytes: file.size,
          type: file.size > 8 * 1024 * 1024 ? 'large_chunked' : 'normal',
          channel_id: channel.id,
          mime_type: file.mimetype,
          upload_complete: false,
          is_public: false,
        });
        
        // Create batch item record
        const batchItem = await storage.createBatchOperationItem({
          batch_id: batchId,
          file_id: fileRecord.id,
          status: 'pending',
        });
        
        // Upload the file
        const messageId = await discordService.uploadFile(channelId, token, file);
        
        // Update file record
        await storage.updateFileUploadComplete(fileRecord.id, messageId);
        
        // Update batch item
        await storage.updateBatchOperationItem(batchItem.id, { status: 'completed' });
        
        // Record operation
        await profileService.recordOperation(userId, fileRecord.id, 'upload');
        
        // Increment completed count
        completedFiles++;
        
        // Update batch progress
        await storage.updateBatchOperation(batchId, { completed_files: completedFiles });
        
      } catch (error) {
        // Record failure
        this.notifyClient(userId.toString(), {
          type: 'batch_error',
          batchId,
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
    
    // Update batch status
    const finalStatus = completedFiles === files.length ? 'completed' : 'completed_with_errors';
    await storage.updateBatchOperation(batchId, { 
      status: finalStatus,
      completed_files: completedFiles,
      completed_at: new Date()
    });
    
    // Send completion notification
    this.notifyClient(userId.toString(), {
      type: 'batch_complete',
      batchId,
      total: files.length,
      completed: completedFiles,
      status: finalStatus
    });
  }
  
  /**
   * Create a batch download operation
   * @param userId User ID
   * @param fileIds File IDs to download
   * @param channelId Discord channel ID
   * @param token Discord token
   * @returns Created batch operation
   */
  async createBatchDownload(userId: number, fileIds: number[], channelId: string, token: string) {
    // Create the batch operation
    const batchOp = await storage.createBatchOperation({
      user_id: userId,
      operation_type: 'download',
      status: 'pending',
      total_files: fileIds.length,
    });
    
    // Process the batch in the background
    this.processBatchDownload(batchOp.id, userId, fileIds, channelId, token);
    
    return batchOp;
  }
  
  /**
   * Process a batch download operation
   * @param batchId Batch operation ID
   * @param userId User ID
   * @param fileIds File IDs to download
   * @param channelId Discord channel ID
   * @param token Discord token
   */
  private async processBatchDownload(
    batchId: number,
    userId: number,
    fileIds: number[],
    channelId: string,
    token: string
  ) {
    // Update batch status
    await storage.updateBatchOperation(batchId, { status: 'in_progress' });
    
    // Process each file
    let completedFiles = 0;
    
    for (const fileId of fileIds) {
      try {
        // Get file info
        const file = await storage.getFile(fileId);
        if (!file) {
          throw new Error(`File with ID ${fileId} not found`);
        }
        
        // Notify progress
        this.notifyClient(userId.toString(), {
          type: 'batch_progress',
          batchId,
          total: fileIds.length,
          completed: completedFiles,
          current: file.original_filename
        });
        
        // Create batch item record
        const batchItem = await storage.createBatchOperationItem({
          batch_id: batchId,
          file_id: fileId,
          status: 'pending',
        });
        
        // Placeholder for download logic
        // In a real implementation, we would download the file here
        
        // Update batch item
        await storage.updateBatchOperationItem(batchItem.id, { status: 'completed' });
        
        // Record operation
        await profileService.recordOperation(userId, fileId, 'download');
        
        // Increment completed count
        completedFiles++;
        
        // Update batch progress
        await storage.updateBatchOperation(batchId, { completed_files: completedFiles });
        
      } catch (error) {
        // Record failure
        this.notifyClient(userId.toString(), {
          type: 'batch_error',
          batchId,
          fileId,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
    
    // Update batch status
    const finalStatus = completedFiles === fileIds.length ? 'completed' : 'completed_with_errors';
    await storage.updateBatchOperation(batchId, { 
      status: finalStatus,
      completed_files: completedFiles,
      completed_at: new Date()
    });
    
    // Send completion notification
    this.notifyClient(userId.toString(), {
      type: 'batch_complete',
      batchId,
      total: fileIds.length,
      completed: completedFiles,
      status: finalStatus
    });
  }
  
  /**
   * Get batch operations for a user
   * @param userId User ID
   * @param limit Max number of operations to return
   * @returns List of batch operations
   */
  async getBatchOperations(userId: number, limit: number = 10) {
    return storage.getBatchOperationsByUser(userId, limit);
  }
  
  /**
   * Get details of a batch operation
   * @param batchId Batch operation ID
   * @returns Batch operation with items
   */
  async getBatchDetails(batchId: number) {
    const batchOp = await storage.getBatchOperation(batchId);
    if (!batchOp) {
      return null;
    }
    
    const items = await storage.getBatchOperationItems(batchId);
    
    return {
      ...batchOp,
      items
    };
  }
}

export const batchService = new BatchService();