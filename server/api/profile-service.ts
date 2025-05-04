import { storage } from '../storage';
import { type UserProfile, InsertUserProfile } from '@shared/schema';

/**
 * Service for managing user profiles and preferences
 */
export class ProfileService {
  /**
   * Get or create a user profile
   * @param userId The user ID to get/create profile for
   * @returns The user profile
   */
  async getOrCreateProfile(userId: number): Promise<UserProfile | null> {
    // First check if profile exists
    const existingProfile = await storage.getUserProfile(userId);
    
    if (existingProfile) {
      // Update last active time and return the profile
      return storage.updateUserProfile(userId, {});
    }
    
    // Check if user exists
    const existingUser = await storage.getUser(userId);
    
    if (!existingUser) {
      console.log(`User with ID ${userId} not found. Cannot create profile.`);
      return null; // Return null instead of trying to create a user
    }
    
    // User exists but no profile, create one
    // Get client IP from auth middleware or use another method to get real IP
    // For now, we'll use request-ip package approach similar to what's in auth.ts
    const newProfile: InsertUserProfile = {
      user_id: userId,
      display_name: existingUser.username || `User ${userId}`,
      device_name: existingUser.username, // Store username as device_name
      // Use a real IP when available - for now use the getClientIp function from auth.ts
      email: "Unknown IP", // Use email field for IP storage
      theme: 'system',
      preferences: {}
    };
    
    try {
      return storage.createUserProfile(newProfile);
    } catch (error) {
      console.error(`Error creating profile for user ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Update a user's profile
   * @param userId User ID
   * @param updates Profile updates
   * @returns Updated profile
   */
  async updateProfile(userId: number, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    // Check if profile exists
    const existingProfile = await storage.getUserProfile(userId);
    
    if (existingProfile) {
      // Update existing profile
      return storage.updateUserProfile(userId, updates);
    }
    
    // Profile doesn't exist, check if user exists
    const existingUser = await storage.getUser(userId);
    
    if (!existingUser) {
      console.log(`User with ID ${userId} not found. Cannot update profile.`);
      return null; // Return null instead of trying to create a user
    }
    
    // User exists but profile doesn't, create one with updates
    const newProfile: InsertUserProfile = {
      user_id: userId,
      display_name: updates.display_name || existingUser.username || `User ${userId}`,
      device_name: existingUser.username, // Store username as device_name
      email: updates.email || "Unknown IP", // Use provided email
      theme: updates.theme || 'system',
      preferences: updates.preferences || {}
    };
    
    try {
      return storage.createUserProfile(newProfile);
    } catch (error) {
      console.error(`Error creating profile for user ${userId} during update:`, error);
      return null;
    }
  }
  
  /**
   * Get a user's saved credentials
   * @param userId User ID
   * @returns List of saved credentials
   */
  async getSavedCredentials(userId: number) {
    return storage.getSavedCredentials(userId);
  }
  
  /**
   * Save a new credential for a user
   * @param userId User ID
   * @param name Label for the credential
   * @param channelId Discord channel ID
   * @param tokenHash Hashed token
   * @param isFavorite Whether this credential is a favorite
   * @returns The saved credential
   */
  async saveCredential(
    userId: number, 
    name: string, 
    channelId: string, 
    tokenHash: string, 
    isFavorite: boolean = false
  ) {
    return storage.createSavedCredential({
      user_id: userId,
      name,
      channel_id: channelId,
      token_hash: tokenHash,
      is_favorite: isFavorite
    });
  }
  
  /**
   * Toggle favorite status for a saved credential
   * @param credentialId Credential ID
   * @param isFavorite New favorite status
   * @returns Updated credential
   */
  async toggleFavorite(credentialId: number, isFavorite: boolean) {
    return storage.updateSavedCredential(credentialId, { is_favorite: isFavorite });
  }
  
  /**
   * Delete a saved credential
   * @param credentialId Credential ID
   */
  async deleteCredential(credentialId: number) {
    await storage.deleteSavedCredential(credentialId);
  }
  
  /**
   * Get user's recent file operations
   * @param userId User ID
   * @param limit Max number of operations to return
   * @returns List of recent operations
   */
  async getRecentOperations(userId: number, limit: number = 20) {
    return storage.getFileOperationsByUser(userId, limit);
  }
  
  /**
   * Record a file operation
   * @param userId User ID
   * @param fileId File ID
   * @param operationType Type of operation (upload, download, etc)
   * @param details Additional details
   * @returns Created operation record
   */
  async recordOperation(userId: number, fileId: number, operationType: string, details: any = {}) {
    return storage.createFileOperation({
      user_id: userId,
      file_id: fileId,
      operation_type: operationType,
      details
    });
  }
}

export const profileService = new ProfileService();