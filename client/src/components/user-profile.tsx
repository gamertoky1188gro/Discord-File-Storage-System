import { useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export function UserProfileCard() {
  const { currentUser, profile, isProfileLoading, updateProfile } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [theme, setTheme] = useState(profile?.theme || 'system');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Generate initials from username
  const getInitials = () => {
    if (!currentUser?.username) return '?';
    return currentUser.username.slice(0, 2).toUpperCase();
  };
  
  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setIsSubmitting(true);
    
    try {
      await updateProfile({
        display_name: displayName,
        theme,
      });
      
      setIsEditing(false);
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset form values when toggling edit mode
  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing, reset form
      setDisplayName(profile?.display_name || '');
      setTheme(profile?.theme || 'system');
    }
    setIsEditing(!isEditing);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>
          Manage your profile settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isProfileLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : !profile ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-destructive text-xl font-semibold">
              Profile not found
            </div>
            <div className="text-muted-foreground px-4">
              The user may have been deleted. Please contact the administrator if you believe this is an error.
            </div>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.href = '/auth'}
            >
              Log in with another account
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center">
              <Avatar className="h-20 w-20 mr-6">
                <AvatarFallback className="text-lg">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h3 className="text-xl font-medium">
                  {isEditing ? (
                    <Input 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name"
                      className="max-w-xs"
                    />
                  ) : (
                    displayName || currentUser?.username || 'User'
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  User ID: {currentUser?.id}
                </p>
                {profile && (
                  <>
                    <p className="text-sm text-muted-foreground mt-1">
                      Device: {profile.device_name || 'Unknown Device'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      IP Address: {profile.email || 'Unknown IP'}
                    </p>
                  </>
                )}
              </div>
            </div>
            
            <div className="border-t pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  {isEditing ? (
                    <Select 
                      value={theme} 
                      onValueChange={setTheme}
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center h-10 pl-3 text-sm rounded-md border border-input">
                      <span className="capitalize">{theme}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Last Active</Label>
                  <div className="flex items-center h-10 pl-3 text-sm rounded-md border border-input">
                    {new Date(profile.last_active).toLocaleString()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Account Created</Label>
                  <div className="flex items-center h-10 pl-3 text-sm rounded-md border border-input">
                    {new Date(profile.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {!isProfileLoading && profile && (
          isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleEditToggle}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveProfile}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                    Saving...
                  </>
                ) : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={handleEditToggle}>Edit Profile</Button>
          )
        )}
      </CardFooter>
    </Card>
  );
}