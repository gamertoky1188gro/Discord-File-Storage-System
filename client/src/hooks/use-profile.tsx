import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

// Types for user profile data
export type UserProfile = {
  id: number;
  user_id: number;
  display_name: string | null;
  device_name?: string | null; // Device name (often from user agent)
  email?: string | null; // IP address stored as email
  theme: string;
  preferences: Record<string, any>;
  last_active: string;
  created_at: string;
};

export type SavedCredential = {
  id: number;
  user_id: number;
  name: string;
  channel_id: string;
  is_favorite: boolean;
  last_used: string;
  created_at: string;
};

export type FileOperation = {
  id: number;
  user_id: number;
  file_id: number;
  operation_type: string;
  timestamp: string;
  details: Record<string, any>;
};

// Define the context type
type ProfileContextType = {
  currentUser: { id: number; username: string } | null;
  profile: UserProfile | null;
  savedCredentials: SavedCredential[];
  recentOperations: FileOperation[];
  isProfileLoading: boolean;
  isCredentialsLoading: boolean;
  isOperationsLoading: boolean;
  setCurrentUser: (user: { id: number; username: string } | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  saveCredential: (name: string, channelId: string, token: string, isFavorite?: boolean) => Promise<SavedCredential>;
  deleteCredential: (id: number) => Promise<void>;
  toggleFavorite: (id: number, isFavorite: boolean) => Promise<SavedCredential>;
  refreshProfile: () => void;
  refreshCredentials: () => void;
  refreshOperations: () => void;
};

// Create the context with a default value
const ProfileContext = createContext<ProfileContextType>({
  currentUser: null,
  profile: null,
  savedCredentials: [],
  recentOperations: [],
  isProfileLoading: false,
  isCredentialsLoading: false,
  isOperationsLoading: false,
  setCurrentUser: () => {},
  updateProfile: async () => ({ id: 0 } as UserProfile),
  saveCredential: async () => ({ id: 0 } as SavedCredential),
  deleteCredential: async () => {},
  toggleFavorite: async () => ({ id: 0 } as SavedCredential),
  refreshProfile: () => {},
  refreshCredentials: () => {},
  refreshOperations: () => {},
});

// Provider component that wraps the app
export const ProfileProvider = ({ children, initialUser = null }: { children: ReactNode, initialUser?: { id: number; username: string } | null }) => {
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(initialUser);
  
  // Load profile data
  const { 
    data: profile, 
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refreshProfile 
  } = useQuery({
    queryKey: currentUser ? ['profile', currentUser.id] : ['profile'],
    queryFn: async () => {
      if (!currentUser) return null;
      try {
        const response = await apiRequest<{ profile: UserProfile }>(`/api/profile/${currentUser.id}`);
        return response.profile;
      } catch (error) {
        // Special case for 404 with userNotFound=true
        if (error instanceof Error && error.message.includes('404')) {
          // Check if this is a user deletion case by looking for the userNotFound message
          if (error.message.includes('Profile not found') || error.message.includes('userNotFound')) {
            console.log('User not found, likely deleted');
            // Return null to indicate profile not found but don't throw
            return null;
          }
        }
        // For other errors, rethrow
        throw error;
      }
    },
    enabled: !!currentUser,
    retry: false // Don't retry if we get a 404
  });
  
  // Load saved credentials
  const { 
    data: savedCredentials,
    isLoading: isCredentialsLoading,
    refetch: refreshCredentials 
  } = useQuery({
    queryKey: currentUser ? ['credentials', currentUser.id] : ['credentials'],
    queryFn: async () => {
      if (!currentUser) return [];
      const response = await apiRequest<{ credentials: SavedCredential[] }>(`/api/credentials/${currentUser.id}`);
      return response.credentials;
    },
    enabled: !!currentUser,
  });
  
  // Load operation history
  const { 
    data: recentOperations,
    isLoading: isOperationsLoading,
    refetch: refreshOperations 
  } = useQuery({
    queryKey: currentUser ? ['operations', currentUser.id] : ['operations'],
    queryFn: async () => {
      if (!currentUser) return [];
      const response = await apiRequest<{ operations: FileOperation[] }>(`/api/history/${currentUser.id}`);
      return response.operations;
    },
    enabled: !!currentUser,
  });
  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      if (!currentUser) throw new Error('No user logged in');
      return apiRequest<{ profile: UserProfile }>(`/api/profile/${currentUser.id}`, {
        method: 'POST',
        body: JSON.stringify(updates),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', currentUser?.id] });
    },
  });
  
  // Save credential mutation
  const saveCredentialMutation = useMutation({
    mutationFn: async ({ name, channelId, token, isFavorite }: { name: string; channelId: string; token: string; isFavorite?: boolean }) => {
      if (!currentUser) throw new Error('No user logged in');
      return apiRequest<{ credential: SavedCredential }>('/api/credentials', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.id,
          name,
          channelId,
          token,
          isFavorite,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.credential);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials', currentUser?.id] });
    },
  });
  
  // Delete credential mutation
  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/credentials/${id}`, {
        method: 'DELETE',
      });
      // Return void to satisfy the interface
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials', currentUser?.id] });
    },
  });
  
  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: number; isFavorite: boolean }) => {
      return apiRequest<{ credential: SavedCredential }>(`/api/credentials/${id}/favorite`, {
        method: 'POST',
        body: JSON.stringify({ isFavorite }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.credential);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials', currentUser?.id] });
    },
  });
  
  // Expose methods and state to children
  const value = {
    currentUser,
    profile: profile || null,
    savedCredentials: savedCredentials || [],
    recentOperations: recentOperations || [],
    isProfileLoading,
    isCredentialsLoading,
    isOperationsLoading,
    setCurrentUser,
    updateProfile: (updates: Partial<UserProfile>) => updateProfileMutation.mutateAsync(updates),
    saveCredential: (name: string, channelId: string, token: string, isFavorite?: boolean) => 
      saveCredentialMutation.mutateAsync({ name, channelId, token, isFavorite }),
    deleteCredential: (id: number) => deleteCredentialMutation.mutateAsync(id),
    toggleFavorite: (id: number, isFavorite: boolean) => 
      toggleFavoriteMutation.mutateAsync({ id, isFavorite }),
    refreshProfile: () => refreshProfile(),
    refreshCredentials: () => refreshCredentials(),
    refreshOperations: () => refreshOperations(),
  };
  
  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

// Hook to use the profile context
export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};