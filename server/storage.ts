import { 
  users, type User, type InsertUser,
  channels, type Channel, type InsertChannel,
  files, type File, type InsertFile,
  fileParts, type FilePart, type InsertFilePart,
  userProfiles, type UserProfile, type InsertUserProfile,
  savedCredentials, type SavedCredentials, type InsertSavedCredentials,
  fileOperationsHistory, type FileOperationsHistory, type InsertFileOperationsHistory,
  fileEncryptionKeys, type FileEncryptionKeys, type InsertFileEncryptionKeys,
  batchOperations, type BatchOperations, type InsertBatchOperations,
  batchOperationItems, type BatchOperationItems, type InsertBatchOperationItems
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./db";

// Enhanced storage interface for file management
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getAllProfiles(): Promise<UserProfile[]>;
  
  // Channel methods
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelByDiscordId(discordId: string): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannelLastUsed(id: number): Promise<void>;
  
  // File methods
  getFile(id: number): Promise<File | undefined>;
  getFileByShareId(shareId: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFileUploadComplete(id: number, messageId: string): Promise<void>;
  listFilesByChannel(channelId: number, limit?: number): Promise<File[]>;
  
  // File parts methods
  getFileParts(fileId: number): Promise<FilePart[]>;
  createFilePart(filePart: InsertFilePart): Promise<FilePart>;
  updateFilePartUploadComplete(id: number, messageId: string): Promise<void>;
  
  // User profile methods
  getUserProfile(userId: number): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: number, profile: Partial<UserProfile>): Promise<UserProfile>;
  
  // Saved credentials methods
  getSavedCredentials(userId: number): Promise<SavedCredentials[]>;
  getSavedCredentialById(id: number): Promise<SavedCredentials | undefined>;
  createSavedCredential(credential: InsertSavedCredentials): Promise<SavedCredentials>;
  updateSavedCredential(id: number, credential: Partial<SavedCredentials>): Promise<SavedCredentials>;
  deleteSavedCredential(id: number): Promise<void>;
  
  // File operations history methods
  createFileOperation(operation: InsertFileOperationsHistory): Promise<FileOperationsHistory>;
  getFileOperationsByUser(userId: number, limit?: number): Promise<FileOperationsHistory[]>;
  
  // File encryption methods
  getFileEncryptionKey(fileId: number): Promise<FileEncryptionKeys | undefined>;
  createFileEncryptionKey(key: InsertFileEncryptionKeys): Promise<FileEncryptionKeys>;
  
  // Batch operations methods
  createBatchOperation(operation: InsertBatchOperations): Promise<BatchOperations>;
  getBatchOperation(id: number): Promise<BatchOperations | undefined>;
  updateBatchOperation(id: number, updates: Partial<BatchOperations>): Promise<BatchOperations>;
  getBatchOperationsByUser(userId: number, limit?: number): Promise<BatchOperations[]>;
  
  // Batch operation items methods
  createBatchOperationItem(item: InsertBatchOperationItems): Promise<BatchOperationItems>;
  updateBatchOperationItem(id: number, updates: Partial<BatchOperationItems>): Promise<BatchOperationItems>;
  getBatchOperationItems(batchId: number): Promise<BatchOperationItems[]>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  // This method is commented out until we ensure the email column exists in the database
  async getUserByEmail(email: string): Promise<User | undefined> {
    // The email column might not exist yet in the database
    // Uncomment when the schema is properly migrated
    // const [user] = await db.select().from(users).where(eq(users.email, email));
    // return user;
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async getAllProfiles(): Promise<UserProfile[]> {
    return db.select().from(userProfiles);
  }
  
  // Channel methods
  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel;
  }
  
  async getChannelByDiscordId(discordId: string): Promise<Channel | undefined> {
    const [channel] = await db.select()
      .from(channels)
      .where(eq(channels.discord_channel_id, discordId));
    return channel;
  }
  
  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [newChannel] = await db.insert(channels).values(channel).returning();
    return newChannel;
  }
  
  async updateChannelLastUsed(id: number): Promise<void> {
    await db.update(channels)
      .set({ last_used: new Date() })
      .where(eq(channels.id, id));
  }
  
  // File methods
  async getFile(id: number): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }
  
  async getFileByShareId(shareId: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.share_id, shareId));
    return file;
  }
  
  async createFile(file: InsertFile): Promise<File> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }
  
  async updateFileUploadComplete(id: number, messageId: string): Promise<void> {
    await db.update(files)
      .set({ 
        upload_complete: true,
        discord_message_id: messageId
      })
      .where(eq(files.id, id));
  }
  
  async listFilesByChannel(channelId: number, limit: number = 50): Promise<File[]> {
    return db.select()
      .from(files)
      .where(eq(files.channel_id, channelId))
      .orderBy(desc(files.created_at))
      .limit(limit);
  }
  
  // File parts methods
  async getFileParts(fileId: number): Promise<FilePart[]> {
    return db.select()
      .from(fileParts)
      .where(eq(fileParts.file_id, fileId))
      .orderBy(fileParts.part_number);
  }
  
  async createFilePart(filePart: InsertFilePart): Promise<FilePart> {
    const [newFilePart] = await db.insert(fileParts).values(filePart).returning();
    return newFilePart;
  }
  
  async updateFilePartUploadComplete(id: number, messageId: string): Promise<void> {
    await db.update(fileParts)
      .set({ 
        upload_complete: true,
        discord_message_id: messageId
      })
      .where(eq(fileParts.id, id));
  }

  // User profile methods
  async getUserProfile(userId: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId));
    return profile;
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [newProfile] = await db.insert(userProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateUserProfile(userId: number, profile: Partial<UserProfile>): Promise<UserProfile> {
    const [updatedProfile] = await db.update(userProfiles)
      .set({ 
        ...profile,
        last_active: new Date() 
      })
      .where(eq(userProfiles.user_id, userId))
      .returning();
    return updatedProfile;
  }

  // Saved credentials methods
  async getSavedCredentials(userId: number): Promise<SavedCredentials[]> {
    return db.select()
      .from(savedCredentials)
      .where(eq(savedCredentials.user_id, userId))
      .orderBy(desc(savedCredentials.last_used));
  }

  async getSavedCredentialById(id: number): Promise<SavedCredentials | undefined> {
    const [credential] = await db.select()
      .from(savedCredentials)
      .where(eq(savedCredentials.id, id));
    return credential;
  }

  async createSavedCredential(credential: InsertSavedCredentials): Promise<SavedCredentials> {
    const [newCredential] = await db.insert(savedCredentials)
      .values(credential)
      .returning();
    return newCredential;
  }

  async updateSavedCredential(id: number, credential: Partial<SavedCredentials>): Promise<SavedCredentials> {
    const [updatedCredential] = await db.update(savedCredentials)
      .set({ 
        ...credential,
        last_used: new Date() 
      })
      .where(eq(savedCredentials.id, id))
      .returning();
    return updatedCredential;
  }

  async deleteSavedCredential(id: number): Promise<void> {
    await db.delete(savedCredentials)
      .where(eq(savedCredentials.id, id));
  }

  // File operations history methods
  async createFileOperation(operation: InsertFileOperationsHistory): Promise<FileOperationsHistory> {
    const [newOperation] = await db.insert(fileOperationsHistory)
      .values(operation)
      .returning();
    return newOperation;
  }

  async getFileOperationsByUser(userId: number, limit: number = 50): Promise<FileOperationsHistory[]> {
    return db.select()
      .from(fileOperationsHistory)
      .where(eq(fileOperationsHistory.user_id, userId))
      .orderBy(desc(fileOperationsHistory.timestamp))
      .limit(limit);
  }

  // File encryption methods
  async getFileEncryptionKey(fileId: number): Promise<FileEncryptionKeys | undefined> {
    const [key] = await db.select()
      .from(fileEncryptionKeys)
      .where(eq(fileEncryptionKeys.file_id, fileId));
    return key;
  }

  async createFileEncryptionKey(key: InsertFileEncryptionKeys): Promise<FileEncryptionKeys> {
    const [newKey] = await db.insert(fileEncryptionKeys)
      .values(key)
      .returning();
    return newKey;
  }

  // Batch operations methods
  async createBatchOperation(operation: InsertBatchOperations): Promise<BatchOperations> {
    const [newOperation] = await db.insert(batchOperations)
      .values(operation)
      .returning();
    return newOperation;
  }

  async getBatchOperation(id: number): Promise<BatchOperations | undefined> {
    const [operation] = await db.select()
      .from(batchOperations)
      .where(eq(batchOperations.id, id));
    return operation;
  }

  async updateBatchOperation(id: number, updates: Partial<BatchOperations>): Promise<BatchOperations> {
    const [updatedOperation] = await db.update(batchOperations)
      .set(updates)
      .where(eq(batchOperations.id, id))
      .returning();
    return updatedOperation;
  }

  async getBatchOperationsByUser(userId: number, limit: number = 20): Promise<BatchOperations[]> {
    return db.select()
      .from(batchOperations)
      .where(eq(batchOperations.user_id, userId))
      .orderBy(desc(batchOperations.created_at))
      .limit(limit);
  }

  // Batch operation items methods
  async createBatchOperationItem(item: InsertBatchOperationItems): Promise<BatchOperationItems> {
    const [newItem] = await db.insert(batchOperationItems)
      .values(item)
      .returning();
    return newItem;
  }

  async updateBatchOperationItem(id: number, updates: Partial<BatchOperationItems>): Promise<BatchOperationItems> {
    const [updatedItem] = await db.update(batchOperationItems)
      .set(updates)
      .where(eq(batchOperationItems.id, id))
      .returning();
    return updatedItem;
  }

  async getBatchOperationItems(batchId: number): Promise<BatchOperationItems[]> {
    return db.select()
      .from(batchOperationItems)
      .where(eq(batchOperationItems.batch_id, batchId));
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
