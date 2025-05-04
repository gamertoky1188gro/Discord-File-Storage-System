import { pgTable, text, serial, integer, boolean, timestamp, uuid, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // No email or updated_at columns in actual database
  created_at: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  // No email field in users table
  created_at: true,
  // No updated_at field in users table
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// File type enum
export const fileTypeEnum = pgEnum("file_type", ["normal", "large_chunked"]);

// Channels table
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  discord_channel_id: text("discord_channel_id").notNull().unique(),
  name: text("name"),
  created_at: timestamp("created_at").defaultNow(),
  last_used: timestamp("last_used").defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channels).pick({
  discord_channel_id: true,
  name: true,
});

export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;

// Files table
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  original_filename: text("original_filename").notNull(),
  size_bytes: integer("size_bytes").notNull(),
  type: fileTypeEnum("type").notNull().default("normal"),
  channel_id: integer("channel_id").references(() => channels.id).notNull(),
  discord_message_id: text("discord_message_id"),
  upload_complete: boolean("upload_complete").default(false),
  is_public: boolean("is_public").default(false),
  share_id: uuid("share_id").defaultRandom(),
  created_at: timestamp("created_at").defaultNow(),
  mime_type: text("mime_type"),
});

export const channelsRelations = relations(channels, ({ many }) => ({
  files: many(files),
}));

export const filesRelations = relations(files, ({ one }) => ({
  channel: one(channels, {
    fields: [files.channel_id],
    references: [channels.id],
  }),
}));

// File parts (for chunked files)
export const fileParts = pgTable("file_parts", {
  id: serial("id").primaryKey(),
  file_id: integer("file_id").references(() => files.id).notNull(),
  part_number: integer("part_number").notNull(),
  size_bytes: integer("size_bytes").notNull(),
  discord_message_id: text("discord_message_id"),
  upload_complete: boolean("upload_complete").default(false),
});

export const filePartsRelations = relations(fileParts, ({ one }) => ({
  file: one(files, {
    fields: [fileParts.file_id],
    references: [files.id],
  }),
}));

export const filesFilePartsRelations = relations(files, ({ many }) => ({
  parts: many(fileParts),
}));

// Insert schemas
export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  created_at: true,
  share_id: true,
});

export const insertFilePartSchema = createInsertSchema(fileParts).omit({
  id: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export type InsertFilePart = z.infer<typeof insertFilePartSchema>;
export type FilePart = typeof fileParts.$inferSelect;

// User profiles table - for storing user preferences and settings
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  display_name: text("display_name"),
  email: text("email"), // Store IP address as email for new users
  device_name: text("device_name"), // Store device info
  theme: text("theme").default("system"),
  preferences: jsonb("preferences").default({}),
  last_active: timestamp("last_active").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.user_id],
    references: [users.id],
  }),
}));

export const usersProfilesRelations = relations(users, ({ one }) => ({
  profile: one(userProfiles),
}));

// Saved credentials for quick access
export const savedCredentials = pgTable("saved_credentials", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  name: text("name").notNull(), // Nickname/label for this credential set
  channel_id: text("channel_id").notNull(),
  token_hash: text("token_hash").notNull(), // Hashed token for security
  is_favorite: boolean("is_favorite").default(false),
  last_used: timestamp("last_used").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

export const savedCredentialsRelations = relations(savedCredentials, ({ one }) => ({
  user: one(users, {
    fields: [savedCredentials.user_id],
    references: [users.id],
  }),
}));

export const usersSavedCredentialsRelations = relations(users, ({ many }) => ({
  savedCredentials: many(savedCredentials),
}));

// Insert schemas for user profiles and saved credentials
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  created_at: true,
  last_active: true,
});

export const insertSavedCredentialsSchema = createInsertSchema(savedCredentials).omit({
  id: true,
  created_at: true,
  last_used: true,
});

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export type InsertSavedCredentials = z.infer<typeof insertSavedCredentialsSchema>;
export type SavedCredentials = typeof savedCredentials.$inferSelect;

// File operation history table
export const fileOperationsHistory = pgTable("file_operations_history", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  file_id: integer("file_id").references(() => files.id),
  operation_type: text("operation_type").notNull(), // 'upload', 'download', 'delete', etc.
  timestamp: timestamp("timestamp").defaultNow(),
  details: jsonb("details").default({}),
});

export const fileOperationsHistoryRelations = relations(fileOperationsHistory, ({ one }) => ({
  user: one(users, {
    fields: [fileOperationsHistory.user_id],
    references: [users.id],
  }),
  file: one(files, {
    fields: [fileOperationsHistory.file_id],
    references: [files.id],
  }),
}));

// File encryption keys for encrypted files
export const fileEncryptionKeys = pgTable("file_encryption_keys", {
  id: serial("id").primaryKey(),
  file_id: integer("file_id").references(() => files.id).notNull(),
  key_hash: text("key_hash").notNull(), // Hashed encryption key
  salt: text("salt").notNull(),
  algorithm: text("algorithm").notNull().default("aes-256-gcm"),
  created_at: timestamp("created_at").defaultNow(),
});

export const fileEncryptionKeysRelations = relations(fileEncryptionKeys, ({ one }) => ({
  file: one(files, {
    fields: [fileEncryptionKeys.file_id],
    references: [files.id],
  }),
}));

// Batch operations
export const batchOperations = pgTable("batch_operations", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  operation_type: text("operation_type").notNull(), // 'upload', 'download'
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'failed'
  total_files: integer("total_files").notNull(),
  completed_files: integer("completed_files").notNull().default(0),
  created_at: timestamp("created_at").defaultNow(),
  completed_at: timestamp("completed_at"),
  details: jsonb("details").default({}),
});

export const batchOperationsRelations = relations(batchOperations, ({ one }) => ({
  user: one(users, {
    fields: [batchOperations.user_id],
    references: [users.id],
  }),
}));

// Batch operation items
export const batchOperationItems = pgTable("batch_operation_items", {
  id: serial("id").primaryKey(),
  batch_id: integer("batch_id").references(() => batchOperations.id).notNull(),
  file_id: integer("file_id").references(() => files.id),
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'failed'
  details: jsonb("details").default({}),
});

export const batchOperationItemsRelations = relations(batchOperationItems, ({ one }) => ({
  batch: one(batchOperations, {
    fields: [batchOperationItems.batch_id],
    references: [batchOperations.id],
  }),
  file: one(files, {
    fields: [batchOperationItems.file_id],
    references: [files.id],
  }),
}));

export const batchOperationsBatchItemsRelations = relations(batchOperations, ({ many }) => ({
  items: many(batchOperationItems),
}));

// Insert schemas for new tables
export const insertFileOperationsHistorySchema = createInsertSchema(fileOperationsHistory).omit({
  id: true,
  timestamp: true,
});

export const insertFileEncryptionKeysSchema = createInsertSchema(fileEncryptionKeys).omit({
  id: true,
  created_at: true,
});

export const insertBatchOperationsSchema = createInsertSchema(batchOperations).omit({
  id: true,
  created_at: true,
  completed_at: true,
  completed_files: true,
});

export const insertBatchOperationItemsSchema = createInsertSchema(batchOperationItems).omit({
  id: true,
});

export type InsertFileOperationsHistory = z.infer<typeof insertFileOperationsHistorySchema>;
export type FileOperationsHistory = typeof fileOperationsHistory.$inferSelect;

export type InsertFileEncryptionKeys = z.infer<typeof insertFileEncryptionKeysSchema>;
export type FileEncryptionKeys = typeof fileEncryptionKeys.$inferSelect;

export type InsertBatchOperations = z.infer<typeof insertBatchOperationsSchema>;
export type BatchOperations = typeof batchOperations.$inferSelect;

export type InsertBatchOperationItems = z.infer<typeof insertBatchOperationItemsSchema>;
export type BatchOperationItems = typeof batchOperationItems.$inferSelect;
