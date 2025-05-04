import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export function FileBrowserCard() {
  const [channelId, setChannelId] = useState("");
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Mock data for display
  const storageData = {
    used: 2500000000, // 2.5 GB in bytes
    total: 10000000000 // 10 GB in bytes
  };
  
  // Format bytes to human readable format
  const formatBytes = (bytes: number, decimals: number = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const handleAuthenticate = () => {
    if (channelId && token) {
      setIsAuthenticated(true);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>File Browser</CardTitle>
        <CardDescription>Browse and manage your Discord files</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="channelId">Discord Channel ID</Label>
            <Input
              id="channelId"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Enter channel ID"
              disabled={isAuthenticated}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Discord Token</Label>
            <Input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your token"
              disabled={isAuthenticated}
            />
          </div>
        </div>
        
        {!isAuthenticated ? (
          <Button 
            onClick={handleAuthenticate} 
            className="w-full mt-2"
          >
            Connect to Discord
          </Button>
        ) : (
          <>
            <Button 
              variant="outline" 
              onClick={() => setIsAuthenticated(false)} 
              className="w-full mt-2"
            >
              Change Credentials
            </Button>
            
            {/* Storage usage display */}
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Used: {formatBytes(storageData.used)} of {formatBytes(storageData.total)}</span>
                <span>{Math.round((storageData.used / storageData.total) * 100)}%</span>
              </div>
              <Progress value={(storageData.used / storageData.total) * 100} className="h-2" />
            </div>
            
            <div className="p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 22h14"></path>
                <path d="M5 2h14"></path>
                <rect width="10" height="14" x="7" y="4" rx="2"></rect>
              </svg>
              <h3 className="font-medium text-lg mb-2">No files found</h3>
              <p className="text-muted-foreground text-sm">
                Enter valid credentials to view files stored in Discord
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}