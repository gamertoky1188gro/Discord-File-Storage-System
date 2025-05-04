import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { UserProfileCard } from '@/components/user-profile';
import { SavedCredentialsCard } from '@/components/saved-credentials';
import { FileHistoryCard } from '@/components/file-history';
import { FileBrowserCard } from '@/components/file-browser';
import { BatchOperationCard } from '@/components/batch-operations';
import { ProfileProvider } from '@/hooks/use-profile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Fetch the current user from the API
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // User is not authenticated, redirect to login
          navigate('/auth');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user profile. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [navigate, toast]);
  
  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    // This should not happen as we redirect in the useEffect, but just in case
    return null;
  }
  
  return (
    <ProfileProvider initialUser={user}>
      <div className="container py-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">My Profile</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Manage your profile, credentials, file operations, and file browser.
        </p>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="mb-4 mx-auto flex justify-center w-auto">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="credentials">Saved Credentials</TabsTrigger>
            <TabsTrigger value="history">File History</TabsTrigger>
            <TabsTrigger value="batch">Batch Operations</TabsTrigger>
            <TabsTrigger value="files">File Browser</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6">
            <UserProfileCard />
          </TabsContent>
          
          <TabsContent value="credentials" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <SavedCredentialsCard />
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <FileHistoryCard />
            </div>
          </TabsContent>
          
          <TabsContent value="batch" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <BatchOperationCard userId={user?.id} />
            </div>
          </TabsContent>
          
          <TabsContent value="files" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <FileBrowserCard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ProfileProvider>
  );
}