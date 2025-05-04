import { useState } from 'react';
import { useProfile, type SavedCredential } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function SavedCredentialsCard() {
  const { savedCredentials, isCredentialsLoading, saveCredential, deleteCredential, toggleFavorite } = useProfile();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const { toast } = useToast();
  
  const handleDeleteCredential = async (id: number, name: string) => {
    try {
      await deleteCredential(id);
      toast({
        title: 'Credential deleted',
        description: `Successfully deleted credential "${name}"`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete credential',
        variant: 'destructive',
      });
    }
  };
  
  const handleToggleFavorite = async (id: number, isFavorite: boolean) => {
    try {
      await toggleFavorite(id, isFavorite);
      toast({
        title: isFavorite ? 'Added to favorites' : 'Removed from favorites',
        description: `Successfully ${isFavorite ? 'added credential to' : 'removed credential from'} favorites`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update favorite status',
        variant: 'destructive',
      });
    }
  };
  
  // Filter credentials based on active tab
  const filteredCredentials = activeTab === 'all' 
    ? savedCredentials 
    : savedCredentials.filter(cred => cred.is_favorite);
  
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Saved Credentials</span>
          <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
            Add New
          </Button>
        </CardTitle>
        <CardDescription>
          Your saved Discord tokens and channel IDs for quick access
        </CardDescription>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="all" 
            className={activeTab === 'all' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('all')}
          >
            All
          </TabsTrigger>
          <TabsTrigger 
            value="favorites" 
            className={activeTab === 'favorites' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('favorites')}
          >
            Favorites
          </TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        {isCredentialsLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {filteredCredentials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="text-4xl mb-4">🔑</div>
                <h3 className="text-lg font-medium mb-2">No saved credentials</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {activeTab === 'all' 
                    ? 'You haven\'t saved any Discord credentials yet.' 
                    : 'You haven\'t marked any credentials as favorites.'}
                </p>
                {activeTab === 'favorites' && savedCredentials.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('all')}>
                    View All Credentials
                  </Button>
                )}
                {savedCredentials.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
                    Add Your First Credential
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[calc(100%-1rem)]">
                <div className="space-y-3">
                  {filteredCredentials.map((credential) => (
                    <CredentialItem 
                      key={credential.id}
                      credential={credential}
                      onDelete={() => handleDeleteCredential(credential.id, credential.name)}
                      onToggleFavorite={(isFavorite) => handleToggleFavorite(credential.id, isFavorite)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
      <NewCredentialDialog 
        open={isAddOpen} 
        onOpenChange={setIsAddOpen} 
        onSave={saveCredential} 
      />
    </Card>
  );
}

function CredentialItem({ 
  credential, 
  onDelete, 
  onToggleFavorite 
}: { 
  credential: SavedCredential; 
  onDelete: () => void; 
  onToggleFavorite: (isFavorite: boolean) => void;
}) {
  return (
    <Card className="p-4 relative overflow-hidden">
      {credential.is_favorite && (
        <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-y-[-50%] translate-x-[50%] rotate-45 bg-primary text-primary-foreground w-16 h-16"></div>
          <div className="absolute top-1 right-1 text-xs text-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
        </div>
      )}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium truncate pr-10">{credential.name}</h3>
          <div className="flex items-center space-x-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => onToggleFavorite(!credential.is_favorite)}
                  >
                    {credential.is_favorite ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {credential.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete credential</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <Badge variant="outline" className="w-fit mb-3">Channel ID: {credential.channel_id}</Badge>
        <div className="text-xs text-muted-foreground">
          Last used: {new Date(credential.last_used).toLocaleDateString()}
        </div>
      </div>
    </Card>
  );
}

function NewCredentialDialog({ 
  open, 
  onOpenChange,
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, channelId: string, token: string, isFavorite?: boolean) => Promise<SavedCredential>;
}) {
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [token, setToken] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !channelId || !token) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSave(name, channelId, token, isFavorite);
      
      toast({
        title: 'Credential saved',
        description: 'Successfully saved Discord credential',
      });
      
      // Reset form and close dialog
      setName('');
      setChannelId('');
      setToken('');
      setIsFavorite(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save credential',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save New Credential</DialogTitle>
          <DialogDescription>
            Add a new Discord token and channel ID to quickly access them later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name" 
                placeholder="My Discord Channel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="channelId">Channel ID</Label>
              <Input 
                id="channelId" 
                placeholder="1234567890123456789"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="token">Discord Token</Label>
              <Input 
                id="token" 
                type="password"
                placeholder="Your Discord token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Your token is stored securely and never shared.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="favorite" 
                checked={isFavorite}
                onCheckedChange={setIsFavorite}
              />
              <Label htmlFor="favorite">Add to favorites</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Saving...
                </>
              ) : 'Save Credential'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}