import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { discordService } from "./api/discord-service";
import { credentialService } from "./api/credential-service";
import { profileService } from "./api/profile-service";
import { batchService } from "./api/batch-service";
import { encryptionService } from "./api/encryption-service";
import { hashPassword } from "./auth";
import { z } from "zod";
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { db } from "./db";
import { 
  files, 
  fileOperationsHistory, 
  users, 
  fileParts, 
  userProfiles, 
  savedCredentials, 
  fileEncryptionKeys, 
  batchOperations 
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { setupAuth } from "./auth";

// App settings
const appSettings = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  defaultChunkSize: 9 * 1024 * 1024, // 9MB
  allowedFileTypes: '*',
  serverVersion: '1.0.0',
  maintenanceMode: false,
  registrationEnabled: true
};

// Dynamic multer configuration that uses the current maxFileSize setting
function getMulterUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: appSettings.maxFileSize, // Dynamically use the current setting
    },
  });
}

// Helper function to get a configured upload middleware
const upload = {
  single: (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
    getMulterUpload().single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            message: `File too large. Maximum size is ${Math.round(appSettings.maxFileSize / (1024 * 1024))}MB.` 
          });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(500).json({ message: "Error uploading file." });
      }
      next();
    });
  },
  array: (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
    getMulterUpload().array(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            message: `File too large. Maximum size is ${Math.round(appSettings.maxFileSize / (1024 * 1024))}MB.` 
          });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(500).json({ message: "Error uploading files." });
      }
      next();
    });
  }
};

// Validation schemas
const uploadSchema = z.object({
  token: z.string().min(1, { message: "Token is required" }),
  channel_id: z.string().min(1, { message: "Channel ID is required" }),
  channel_name: z.string().optional(),
});

const downloadSchema = z.object({
  filename: z.string().min(1, { message: "Filename is required" }),
  large: z.boolean().default(false),
  token: z.string().min(1, { message: "Token is required" }),
  channel_id: z.string().min(1, { message: "Channel ID is required" }),
});

const listFilesSchema = z.object({
  token: z.string().min(1, { message: "Token is required" }),
  channel_id: z.string().min(1, { message: "Channel ID is required" }),
});

const listDatabaseFilesSchema = z.object({
  channel_id: z.string().min(1, { message: "Channel ID is required" }),
  limit: z.number().optional(),
});

// User profile schemas
const userProfileSchema = z.object({
  display_name: z.string().optional(),
  theme: z.string().optional(),
  preferences: z.record(z.any()).optional(),
});

// Credential schemas
const saveCredentialSchema = z.object({
  userId: z.number({ required_error: "User ID is required" }),
  name: z.string().optional(),
  channelId: z.string().min(1, { message: "Channel ID is required" }),
  token: z.string().min(1, { message: "Token is required" }),
  isFavorite: z.boolean().optional().default(false),
});

// Batch operation schemas
const batchUploadSchema = z.object({
  userId: z.number({ required_error: "User ID is required" }),
  channelId: z.string().min(1, { message: "Channel ID is required" }),
  token: z.string().min(1, { message: "Token is required" }),
});

const batchDownloadSchema = z.object({
  userId: z.number({ required_error: "User ID is required" }),
  channelId: z.string().min(1, { message: "Channel ID is required" }),
  token: z.string().min(1, { message: "Token is required" }),
  fileIds: z.array(z.number()).min(1, { message: "At least one file ID is required" }),
});

// Encryption schemas
const encryptFileSchema = z.object({
  fileId: z.number({ required_error: "File ID is required" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    ws.on('message', (message) => {
      console.log('Received message:', message.toString());
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Helper function to broadcast messages to all connected clients
  const broadcastMessage = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Upload file to Discord
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }
      
      // Validate request body
      const result = uploadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { token, channel_id, channel_name } = result.data;
      
      // Get or create channel record
      let channel = await storage.getChannelByDiscordId(channel_id);
      if (!channel) {
        channel = await storage.createChannel({
          discord_channel_id: channel_id,
          name: channel_name || `Channel ${channel_id}`,
        });
      } else {
        await storage.updateChannelLastUsed(channel.id);
      }
      
      // Determine if this is a large file that needs to be chunked
      const isLarge = req.file.size > 10 * 1024 * 1024; // > 10MB
      
      // Create file record
      const file = await storage.createFile({
        filename: req.file.originalname,
        original_filename: req.file.originalname,
        size_bytes: req.file.size,
        type: isLarge ? "large_chunked" : "normal",
        channel_id: channel.id,
        upload_complete: false,
        is_public: false,
        mime_type: req.file.mimetype || 'application/octet-stream',
      });
      
      // Upload file to Discord
      const messageId = await discordService.uploadFile(channel_id, token, req.file);
      
      // Update file record with messageId and mark as complete
      await storage.updateFileUploadComplete(file.id, messageId);
      
      // Broadcast the new file to connected clients
      broadcastMessage('file_uploaded', {
        id: file.id,
        filename: file.filename,
        size: file.size_bytes,
        channelId: channel.id
      });
      
      return res.status(200).json({
        message: "File uploaded successfully",
        messageId,
        filename: req.file.originalname,
        file_id: file.id,
        share_id: file.share_id
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to upload file"
      });
    }
  });

  // Download file from Discord
  app.post("/api/download", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = downloadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { filename, large, token, channel_id } = result.data;
      
      // Check if we have this file in our database
      let channel = await storage.getChannelByDiscordId(channel_id);
      
      // If we have the channel and the file, update last used time
      if (channel) {
        await storage.updateChannelLastUsed(channel.id);
      }
      
      // Download file from Discord
      const fileBuffer = await discordService.downloadFile(channel_id, token, filename, large);
      
      // Set appropriate headers for file download
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      
      // Try to determine MIME type from filename extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      // Simple MIME type mapping for common files
      if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.txt') contentType = 'text/plain';
      else if (ext === '.zip') contentType = 'application/zip';
      
      res.setHeader("Content-Type", contentType);
      
      // Send the file as a response
      return res.status(200).send(fileBuffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to download file"
      });
    }
  });

  // List files in a Discord channel (from Discord API)
  app.post("/api/list-files", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = listFilesSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { token, channel_id } = result.data;
      
      // Get list of file attachments in the channel
      const attachments = await discordService.findFileMessages(channel_id, token);
      
      return res.status(200).json({
        message: "Files retrieved successfully",
        files: attachments
      });
    } catch (error) {
      console.error("Error listing files:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to list files"
      });
    }
  });

  // List files from database (files we have uploaded/tracked)
  app.post("/api/db-files", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = listDatabaseFilesSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { channel_id, limit } = result.data;
      
      // Get channel from database
      const channel = await storage.getChannelByDiscordId(channel_id);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      
      // Get files for this channel
      const files = await storage.listFilesByChannel(channel.id, limit);
      
      return res.status(200).json({
        message: "Files retrieved successfully",
        channel: {
          id: channel.id,
          discord_id: channel.discord_channel_id,
          name: channel.name,
        },
        files: files.map(file => ({
          id: file.id,
          filename: file.filename,
          original_filename: file.original_filename,
          size: file.size_bytes,
          type: file.type,
          upload_complete: file.upload_complete,
          is_public: file.is_public,
          share_id: file.share_id,
          created_at: file.created_at,
          mime_type: file.mime_type,
        }))
      });
    } catch (error) {
      console.error("Error listing database files:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to list database files"
      });
    }
  });

  // Get file by share ID (for public sharing)
  app.get("/api/shared/:shareId", async (req: Request, res: Response) => {
    try {
      const { shareId } = req.params;
      
      if (!shareId) {
        return res.status(400).json({ message: "Share ID is required" });
      }
      
      // Get file from database
      const file = await storage.getFileByShareId(shareId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if file is public
      if (!file.is_public) {
        return res.status(403).json({ message: "This file is not shared publicly" });
      }
      
      return res.status(200).json({
        id: file.id,
        filename: file.filename,
        size: file.size_bytes,
        type: file.type,
        mime_type: file.mime_type,
        created_at: file.created_at,
      });
    } catch (error) {
      console.error("Error getting shared file:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get shared file"
      });
    }
  });
  
  // Toggle file public status
  app.post("/api/toggle-public", async (req: Request, res: Response) => {
    try {
      const { file_id, is_public } = req.body;
      
      if (file_id === undefined) {
        return res.status(400).json({ message: "File ID is required" });
      }
      
      if (typeof is_public !== 'boolean') {
        return res.status(400).json({ message: "Is public must be a boolean" });
      }
      
      // Get file from database
      const file = await storage.getFile(file_id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Update file public status
      await db.update(files)
        .set({ is_public })
        .where(eq(files.id, file_id));
      
      return res.status(200).json({
        message: `File is now ${is_public ? 'public' : 'private'}`,
        file_id,
        is_public
      });
    } catch (error) {
      console.error("Error toggling file public status:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to toggle file public status"
      });
    }
  });
  
  // User profile endpoints
  
  // Get user profile
  app.get("/api/profile/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get or create user profile
      const profile = await profileService.getOrCreateProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ 
          message: "Profile not found. The user may have been deleted.",
          userNotFound: true
        });
      }
      
      return res.status(200).json({
        message: "Profile retrieved successfully",
        profile
      });
    } catch (error) {
      console.error("Error getting profile:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get profile"
      });
    }
  });
  
  // Update user profile
  app.post("/api/profile/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Validate request body
      const result = userProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      // Update user profile
      const profile = await profileService.updateProfile(userId, result.data);
      
      if (!profile) {
        return res.status(404).json({ 
          message: "Could not update profile. The user may have been deleted.",
          userNotFound: true
        });
      }
      
      return res.status(200).json({
        message: "Profile updated successfully",
        profile
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update profile"
      });
    }
  });
  
  // Get saved credentials
  app.get("/api/credentials/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get saved credentials
      const credentials = await profileService.getSavedCredentials(userId);
      
      // Remove token hashes from response for security
      const safeCredentials = credentials.map(cred => ({
        ...cred,
        token_hash: undefined
      }));
      
      return res.status(200).json({
        message: "Credentials retrieved successfully",
        credentials: safeCredentials
      });
    } catch (error) {
      console.error("Error getting credentials:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get credentials"
      });
    }
  });
  
  // Save credential
  app.post("/api/credentials", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = saveCredentialSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { userId, name, channelId, token, isFavorite } = result.data;
      
      // Hash token
      const tokenHash = credentialService.hashToken(token);
      
      // Save credential
      const credential = await profileService.saveCredential(
        userId,
        name || `Channel ${channelId}`,
        channelId,
        tokenHash,
        isFavorite
      );
      
      return res.status(200).json({
        message: "Credential saved successfully",
        credential: {
          ...credential,
          token_hash: undefined
        }
      });
    } catch (error) {
      console.error("Error saving credential:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to save credential"
      });
    }
  });
  
  // Delete credential
  app.delete("/api/credentials/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid credential ID" });
      }
      
      // Delete credential
      await profileService.deleteCredential(id);
      
      return res.status(200).json({
        message: "Credential deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting credential:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete credential"
      });
    }
  });
  
  // Toggle favorite status
  app.post("/api/credentials/:id/favorite", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { isFavorite } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid credential ID" });
      }
      
      if (typeof isFavorite !== 'boolean') {
        return res.status(400).json({ message: "isFavorite must be a boolean" });
      }
      
      // Toggle favorite status
      const credential = await profileService.toggleFavorite(id, isFavorite);
      
      return res.status(200).json({
        message: `Credential ${isFavorite ? 'added to' : 'removed from'} favorites`,
        credential: {
          ...credential,
          token_hash: undefined
        }
      });
    } catch (error) {
      console.error("Error toggling favorite status:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to toggle favorite status"
      });
    }
  });
  
  // Get operation history
  app.get("/api/history/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ message: "Invalid limit" });
      }
      
      // Get operation history
      const operations = await profileService.getRecentOperations(userId, limit);
      
      return res.status(200).json({
        message: "Operation history retrieved successfully",
        operations
      });
    } catch (error) {
      console.error("Error getting operation history:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get operation history"
      });
    }
  });
  
  // Batch upload files
  app.post("/api/batch/upload", upload.array("files"), async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = batchUploadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { userId, channelId, token } = result.data;
      
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }
      
      // Create batch upload operation
      const batchOp = await batchService.createBatchUpload(
        userId,
        req.files as Express.Multer.File[],
        channelId,
        token
      );
      
      return res.status(200).json({
        message: "Batch upload started",
        batchId: batchOp.id,
        totalFiles: req.files.length
      });
    } catch (error) {
      console.error("Error starting batch upload:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to start batch upload"
      });
    }
  });
  
  // Batch download files
  app.post("/api/batch/download", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = batchDownloadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { userId, channelId, token, fileIds } = result.data;
      
      // Create batch download operation
      const batchOp = await batchService.createBatchDownload(
        userId,
        fileIds,
        channelId,
        token
      );
      
      return res.status(200).json({
        message: "Batch download started",
        batchId: batchOp.id,
        totalFiles: fileIds.length
      });
    } catch (error) {
      console.error("Error starting batch download:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to start batch download"
      });
    }
  });
  
  // Get batch operations
  app.get("/api/batch/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get batch operations
      const operations = await batchService.getBatchOperations(userId);
      
      return res.status(200).json({
        message: "Batch operations retrieved successfully",
        operations
      });
    } catch (error) {
      console.error("Error getting batch operations:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get batch operations"
      });
    }
  });
  
  // Get batch details
  app.get("/api/batch/details/:batchId", async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      
      if (isNaN(batchId)) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }
      
      // Get batch details
      const details = await batchService.getBatchDetails(batchId);
      
      if (!details) {
        return res.status(404).json({ message: "Batch operation not found" });
      }
      
      return res.status(200).json({
        message: "Batch details retrieved successfully",
        details
      });
    } catch (error) {
      console.error("Error getting batch details:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get batch details"
      });
    }
  });
  
  // Encryption endpoints
  
  // Check if a file is encrypted
  app.get("/api/encryption/:fileId", async (req: Request, res: Response) => {
    try {
      const fileId = parseInt(req.params.fileId);
      
      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }
      
      // Get file from database
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if file is encrypted
      const encryptionDetails = await encryptionService.getEncryptionDetails(fileId);
      
      return res.status(200).json({
        message: "Encryption status retrieved successfully",
        isEncrypted: !!encryptionDetails,
        algorithm: encryptionDetails?.algorithm
      });
    } catch (error) {
      console.error("Error checking encryption status:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to check encryption status"
      });
    }
  });
  
  // Encrypt a file that's already uploaded
  app.post("/api/encrypt-file", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = encryptFileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { fileId, password } = result.data;
      
      // Get file from database
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if file is already encrypted
      const existingEncryption = await encryptionService.getEncryptionDetails(fileId);
      if (existingEncryption) {
        return res.status(400).json({ message: "File is already encrypted" });
      }
      
      // Generate key and salt
      const { key, salt } = credentialService.generateEncryptionKey();
      
      // Store encryption details
      await encryptionService.storeEncryptionDetails(fileId, password, salt);
      
      return res.status(200).json({
        message: "File encryption details stored successfully",
        fileId
      });
    } catch (error) {
      console.error("Error encrypting file:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to encrypt file"
      });
    }
  });
  
  // Admin endpoints
  
  // Create a new user (admin only)
  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const { username, password, email, deviceName, isAdmin } = req.body;
      
      // Validate required fields
      if (!username || !username.trim()) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      if (!password || !password.trim()) {
        return res.status(400).json({ message: "Password is required" });
      }
      
      // Check if user with same username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password using the function from auth.ts
      const hashedPassword = await hashPassword(password);
      
      // Create the new user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        // created_at is defaulted in the database schema
      });
      
      // Create user profile if email and device name are provided
      if (email || deviceName) {
        await storage.createUserProfile({
          user_id: user.id,
          display_name: username,
          device_name: deviceName || null,
          email: email || null,
          theme: 'system',
          preferences: {}
        });
      }
      
      // Return success with user info (excluding password)
      return res.status(201).json({
        message: "User created successfully",
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to create user"
      });
    }
  });
  
  // Delete user by ID (admin only)
  app.delete("/api/admin/users/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // First delete related records to handle foreign key constraints
      
      // 1. Delete user profile
      try {
        await db.execute(sql`DELETE FROM ${userProfiles} WHERE user_id = ${userId}`);
        console.log(`Deleted user profile for user ${userId}`);
      } catch (e) {
        console.log(`Error removing user profile for user ${userId}:`, e);
      }
      
      // 2. Delete saved credentials
      try {
        await db.execute(sql`DELETE FROM ${savedCredentials} WHERE user_id = ${userId}`);
        console.log(`Deleted saved credentials for user ${userId}`);
      } catch (e) {
        console.log(`Error removing credentials for user ${userId}:`, e);
      }
      
      // 3. Delete file operations history
      try {
        await db.execute(sql`DELETE FROM ${fileOperationsHistory} WHERE user_id = ${userId}`);
        console.log(`Deleted file operations for user ${userId}`);
      } catch (e) {
        console.log(`Error removing file operations for user ${userId}:`, e);
      }
      
      // 4. Delete batch operations
      try {
        await db.execute(sql`DELETE FROM ${batchOperations} WHERE user_id = ${userId}`);
        console.log(`Deleted batch operations for user ${userId}`);
      } catch (e) {
        console.log(`Error removing batch operations for user ${userId}:`, e);
      }
      
      // Finally delete the user
      await db.execute(sql`DELETE FROM ${users} WHERE id = ${userId}`);
      console.log(`Deleted user ${userId}`);
      
      return res.status(200).json({ 
        message: "User deleted successfully",
        userId
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete user"
      });
    }
  });
  
  // Delete file by ID (admin only)
  app.delete("/api/admin/files/:fileId", async (req: Request, res: Response) => {
    try {
      const fileId = parseInt(req.params.fileId);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }
      
      // Check if file exists
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // First delete related records
      
      // 1. Delete file parts if it's a chunked file
      try {
        // Use direct SQL approach to avoid type errors
        await db.execute(sql`DELETE FROM ${fileParts} WHERE file_id = ${fileId}`);
        console.log(`Deleted file parts for file ${fileId}`);
      } catch (e) {
        console.log(`Error removing file parts for file ${fileId}:`, e);
      }
      
      // 2. Delete file operations related to this file
      try {
        await db.execute(sql`DELETE FROM ${fileOperationsHistory} WHERE file_id = ${fileId}`);
        console.log(`Deleted file operations for file ${fileId}`);
      } catch (e) {
        console.log(`Error removing file operations for file ${fileId}:`, e);
      }
      
      // 3. Delete encryption keys for this file
      try {
        await db.execute(sql`DELETE FROM ${fileEncryptionKeys} WHERE file_id = ${fileId}`);
        console.log(`Deleted encryption keys for file ${fileId}`);
      } catch (e) {
        console.log(`Error removing encryption keys for file ${fileId}:`, e);
      }
      
      // Finally delete the file
      await db.execute(sql`DELETE FROM ${files} WHERE id = ${fileId}`);
      console.log(`Deleted file ${fileId}`);
      
      return res.status(200).json({ 
        message: "File deleted successfully",
        fileId
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete file"
      });
    }
  });
  
  // Update file visibility (admin only)
  app.patch("/api/admin/files/:fileId/visibility", async (req: Request, res: Response) => {
    try {
      const fileId = parseInt(req.params.fileId);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }
      
      // Validate request body
      const visibilitySchema = z.object({
        isPublic: z.boolean()
      });
      
      const result = visibilitySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      
      const { isPublic } = result.data;
      
      // Check if file exists
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Update file visibility
      await db.update(files)
        .set({ is_public: isPublic })
        .where(eq(files.id, fileId));
      
      return res.status(200).json({ 
        message: "File visibility updated successfully",
        fileId,
        isPublic
      });
    } catch (error) {
      console.error("Error updating file visibility:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update file visibility"
      });
    }
  });
  
  // Get system stats for admin dashboard
  app.get("/api/admin/stats", async (req: Request, res: Response) => {
    try {
      // Get total users
      const users = await storage.getAllUsers();
      const totalUsers = users.length;
      
      // Get all files
      const allFiles = await db.select().from(files);
      const totalFiles = allFiles.length;
      
      // Calculate storage used
      const storageUsedBytes = allFiles.reduce((total, file) => total + file.size_bytes, 0);
      const storageUsedGB = storageUsedBytes / (1024 * 1024 * 1024); // Convert to GB
      
      // Get profiles for active users
      const profiles = await storage.getAllProfiles();
      const activeUsers = profiles.filter(profile => {
        // Consider a user active if they've been active in the last 7 days
        if (!profile.last_active) return false;
        const lastActive = new Date(profile.last_active);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return lastActive >= sevenDaysAgo;
      }).length;
      
      // Calculate average file size
      const avgFileSizeMB = totalFiles > 0 
        ? (storageUsedBytes / totalFiles) / (1024 * 1024) // Convert to MB
        : 0;
      
      // Get total file operations as a proxy for requests
      const totalOperations = await db.select({ count: sql`count(*)` }).from(fileOperationsHistory);
      const totalRequests = totalOperations[0]?.count || 0;
      
      return res.status(200).json({
        totalUsers,
        activeUsers,
        totalFiles,
        storageUsed: parseFloat(storageUsedGB.toFixed(2)),
        totalRequests,
        averageFileSize: parseFloat(avgFileSizeMB.toFixed(2))
      });
    } catch (error) {
      console.error("Error getting admin stats:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get admin stats"
      });
    }
  });
  
  // Get all users for admin dashboard
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      // Get all users with profiles
      const allUsers = await storage.getAllUsers();
      const userProfiles = await storage.getAllProfiles();
      
      // Create a map of userId to profile
      const profileMap = new Map();
      userProfiles.forEach(profile => {
        if (profile.user_id) {
          profileMap.set(profile.user_id, profile);
        }
      });
      
      // Combine user and profile data
      const users = allUsers.map(user => {
        const profile = profileMap.get(user.id);
        return {
          id: user.id,
          username: user.username,
          isAdmin: false, // This field doesn't exist in our schema, defaulting to false
          createdAt: user.created_at,
          profile: profile ? {
            id: profile.id,
            displayName: profile.display_name || user.username,
            theme: profile.theme || 'system',
            deviceName: profile.device_name || 'Unknown device',
            lastActive: profile.last_active ? new Date(profile.last_active).toISOString() : null,
            email: profile.email || null
          } : null
        };
      });
      
      return res.status(200).json({ users });
    } catch (error) {
      console.error("Error getting users:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get users"
      });
    }
  });
  
  // Get file statistics for admin dashboard
  app.get("/api/admin/files", async (req: Request, res: Response) => {
    try {
      // Get all files
      const allFiles = await db.select().from(files);
      
      // Group files by type
      const fileTypes = {
        normal: 0,
        large_chunked: 0
      };
      
      allFiles.forEach(file => {
        if (file.type === 'normal') {
          fileTypes.normal++;
        } else if (file.type === 'large_chunked') {
          fileTypes.large_chunked++;
        }
      });
      
      // Get total storage used
      const totalSize = allFiles.reduce((sum, file) => sum + file.size_bytes, 0);
      const storageUsedGB = totalSize / (1024 * 1024 * 1024); // Convert to GB
      
      // Calculate average file size
      const avgFileSizeMB = allFiles.length > 0 
        ? (totalSize / allFiles.length) / (1024 * 1024) 
        : 0;
      
      // Get public vs private files
      const publicFiles = allFiles.filter(file => file.is_public).length;
      const privateFiles = allFiles.length - publicFiles;
      
      return res.status(200).json({
        totalFiles: allFiles.length,
        fileTypes,
        storageUsedGB: parseFloat(storageUsedGB.toFixed(2)),
        avgFileSizeMB: parseFloat(avgFileSizeMB.toFixed(2)),
        publicFiles,
        privateFiles,
        recentFiles: allFiles
          .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 10)
          .map(file => ({
            id: file.id,
            filename: file.filename,
            originalFilename: file.original_filename,
            size: file.size_bytes,
            type: file.type,
            isPublic: file.is_public,
            mimeType: file.mime_type,
            createdAt: file.created_at
          }))
      });
    } catch (error) {
      console.error("Error getting file stats:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get file stats"
      });
    }
  });
  
  // Get system settings for admin dashboard
  
  app.get("/api/admin/settings", async (req: Request, res: Response) => {
    try {
      // Return the current settings
      return res.status(200).json(appSettings);
    } catch (error) {
      console.error("Error getting settings:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get settings"
      });
    }
  });
  
  // Update system settings (admin only)
  app.patch("/api/admin/settings", async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      
      // Validate updates
      if (updates.maxFileSize && typeof updates.maxFileSize === 'number') {
        appSettings.maxFileSize = updates.maxFileSize;
      }
      
      if (updates.defaultChunkSize && typeof updates.defaultChunkSize === 'number') {
        appSettings.defaultChunkSize = updates.defaultChunkSize;
      }
      
      if (updates.allowedFileTypes && typeof updates.allowedFileTypes === 'string') {
        appSettings.allowedFileTypes = updates.allowedFileTypes;
      }
      
      if (typeof updates.maintenanceMode === 'boolean') {
        appSettings.maintenanceMode = updates.maintenanceMode;
      }
      
      if (typeof updates.registrationEnabled === 'boolean') {
        appSettings.registrationEnabled = updates.registrationEnabled;
      }
      
      return res.status(200).json({
        message: "Settings updated successfully",
        settings: appSettings
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update settings"
      });
    }
  });

  // Get system logs for admin dashboard
  app.get("/api/admin/logs", async (req: Request, res: Response) => {
    try {
      // For demonstration, use recent file operations as logs
      const systemLogs = await db
        .select({
          id: fileOperationsHistory.id,
          userId: fileOperationsHistory.user_id,
          operationType: fileOperationsHistory.operation_type,
          timestamp: fileOperationsHistory.timestamp,
          details: fileOperationsHistory.details,
          username: users.username
        })
        .from(fileOperationsHistory)
        .leftJoin(users, eq(fileOperationsHistory.user_id, users.id))
        .orderBy(desc(fileOperationsHistory.timestamp))
        .limit(50);
      
      // Format logs
      const logs = systemLogs.map(log => {
        let level = 'info';
        // Determine log level based on operation
        if (log.operationType?.includes('error')) {
          level = 'error';
        } else if (log.operationType?.includes('warning')) {
          level = 'warning';
        }
        
        return {
          id: log.id,
          timestamp: log.timestamp ? log.timestamp.toISOString() : new Date().toISOString(),
          level,
          message: `User ${log.username || log.userId} performed ${log.operationType}`,
          details: log.details,
          source: 'system'
        };
      });
      
      return res.status(200).json({ logs });
    } catch (error) {
      console.error("Error getting logs:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get logs"
      });
    }
  });
  
  // Get recent activity for admin dashboard
  app.get("/api/admin/activity", async (req: Request, res: Response) => {
    try {
      // Get recent file operations with user and file details
      const recentOperations = await db
        .select({
          id: fileOperationsHistory.id,
          userId: fileOperationsHistory.user_id,
          fileId: fileOperationsHistory.file_id,
          operationType: fileOperationsHistory.operation_type,
          timestamp: fileOperationsHistory.timestamp,
          details: fileOperationsHistory.details,
          username: users.username
        })
        .from(fileOperationsHistory)
        .leftJoin(users, eq(fileOperationsHistory.user_id, users.id))
        .orderBy(desc(fileOperationsHistory.timestamp))
        .limit(10);
      
      // Format the activity data
      const activities = await Promise.all(recentOperations.map(async (op) => {
        let target = "Unknown";
        
        // If we have a file ID, get the filename
        if (op.fileId) {
          const file = await storage.getFile(op.fileId);
          if (file) {
            target = file.original_filename;
          }
        } else if (op.details && typeof op.details === 'object') {
          // Try to get target from operation details
          const details = op.details as Record<string, string>;
          target = details.target || "System";
        }
        
        // Map operation type to a user-friendly action
        let action;
        switch (op.operationType) {
          case 'upload':
            action = 'Uploaded file';
            break;
          case 'download':
            action = 'Downloaded file';
            break;
          case 'delete':
            action = 'Deleted file';
            break;
          case 'share':
            action = 'Shared file';
            break;
          case 'batch_upload':
            action = 'Batch uploaded files';
            break;
          case 'batch_download':
            action = 'Batch downloaded files';
            break;
          case 'profile_update':
            action = 'Updated profile';
            break;
          default:
            action = op.operationType.replace('_', ' ');
        }
        
        return {
          id: op.id,
          user: op.username || `User ${op.userId}`,
          action,
          target,
          timestamp: op.timestamp ? op.timestamp.toISOString() : new Date().toISOString()
        };
      }));
      
      return res.status(200).json({
        activities
      });
    } catch (error) {
      console.error("Error getting admin activity:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get admin activity"
      });
    }
  });

  // Setup auth routes and middleware
  setupAuth(app);
  
  return httpServer;
}
