import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, FileImage, Table, Database, Archive, Download, Trash2 } from 'lucide-react';
import { useProfile } from '@/hooks/use-profile';
import { formatBytes } from '@/lib/format';
import { Progress } from '@/components/ui/progress';

// File type from API response
type FileItem = {
  id: number;
  filename: string;
  size: number;
  type: string;
  mime_type: string;
  is_public: boolean;
  created_at: string;
};

export function FileBrowserCard() {
  // State for form inputs
  const [channelId, setChannelId] = useState('');
  const [token, setToken] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [totalStorage, setTotalStorage] = useState(10 * 1024 * 1024 * 1024); // 10GB default
  const [storagePercent, setStoragePercent] = useState(0);
  const { savedCredentials, currentUser } = useProfile();
  const { toast } = useToast();

  // Automatically fill in credentials if available
  useEffect(() => {
    if (savedCredentials && savedCredentials.length > 0) {
      // Find favorite credential first
      const favorite = savedCredentials.find(cred => cred.is_favorite);
      
      if (favorite) {
        setChannelId(favorite.channel_id);
        // Note: We don't have the token here as it's not returned from the API for security
        // The user will need to enter it manually
      } else if (savedCredentials[0]) {
        // Use the first credential if no favorite
        setChannelId(savedCredentials[0].channel_id);
      }
    }
  }, [savedCredentials]);

  // Function to fetch files
  const fetchFiles = async () => {
    if (!channelId || !token) {
      toast({
        title: "Missing Information",
        description: "Both Channel ID and Discord Token are required.",
        variant: "destructive"
      });
      return;
    }

    setIsFetching(true);
    
    try {
      // Fetch files from database (these are the files we've uploaded)
      const dbResponse = await fetch('/api/db-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_id: channelId,
          limit: 50 // Get up to 50 files
        }),
      });
      
      if (!dbResponse.ok) {
        throw new Error('Failed to fetch files from database');
      }
      
      const dbData = await dbResponse.json();
      const dbFiles = dbData.files || [];
      
      // Calculate storage usage
      const totalSize = dbFiles.reduce((acc: number, file: FileItem) => acc + file.size, 0);
      setStorageUsed(totalSize);
      setStoragePercent(Math.min((totalSize / totalStorage) * 100, 100));
      
      // Sort files by created date (newest first)
      setFiles(dbFiles.sort((a: FileItem, b: FileItem) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch files",
        variant: "destructive"
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Function to download a file
  const downloadFile = async (filename: string, large: boolean = false) => {
    if (!channelId || !token) {
      toast({
        title: "Missing Information",
        description: "Channel ID and Discord Token are required to download files.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Create a download request
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          large,
          token,
          channel_id: channelId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      // Get the blob data and create a download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: `File "${filename}" downloaded successfully.`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download Error",
        description: error instanceof Error ? error.message : "Failed to download file",
        variant: "destructive"
      });
    }
  };

  // Function to get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-4 w-4 text-purple-500" />;
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <Table className="h-4 w-4 text-green-500" />;
    } else if (mimeType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-red-500" />;
    } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      return <Archive className="h-4 w-4 text-orange-500" />;
    } else if (mimeType.includes('database') || mimeType.includes('sql')) {
      return <Database className="h-4 w-4 text-blue-500" />;
    } else {
      return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  // Function to delete a file (placeholder - API doesn't support this yet)
  const deleteFile = async (fileId: number) => {
    toast({
      title: "Not Implemented",
      description: "File deletion is not yet implemented in the API.",
      variant: "default"
    });
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle>File Browser</CardTitle>
        <CardDescription>
          View and manage files stored in Discord. Enter your credentials to access files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="channel-id">Discord Channel ID</Label>
            <Input 
              id="channel-id"
              type="text" 
              placeholder="Enter channel ID" 
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discord-token">Discord Token</Label>
            <Input 
              id="discord-token"
              type="password" 
              placeholder="Enter token" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
        </div>
        
        <Button 
          className="w-full md:w-auto"
          onClick={fetchFiles}
          disabled={isFetching}
        >
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Connect & Load Files'
          )}
        </Button>
        
        {files.length > 0 && (
          <>
            {/* Storage usage information */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Used: {formatBytes(storageUsed)} of {formatBytes(totalStorage)}</span>
                <span>{storagePercent.toFixed(1)}%</span>
              </div>
              <Progress value={storagePercent} className="h-2" />
            </div>
            
            {/* File List */}
            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-5 bg-muted p-3 text-sm font-medium">
                <div className="col-span-2">Filename</div>
                <div className="text-center">Size</div>
                <div className="text-center">Type</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y">
                {files.map((file) => (
                  <div key={file.id} className="grid grid-cols-5 p-3 items-center hover:bg-muted/50">
                    <div className="col-span-2 flex items-center gap-2">
                      {getFileIcon(file.mime_type)}
                      <span className="truncate">{file.filename}</span>
                    </div>
                    <div className="text-center">{formatBytes(file.size)}</div>
                    <div className="text-center">
                      {file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        title="Download"
                        onClick={() => downloadFile(file.filename, file.type === 'large_chunked')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        title="Delete"
                        onClick={() => deleteFile(file.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {files.length === 0 && !isFetching && (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md">
            <div className="text-4xl mb-4">📂</div>
            <h3 className="text-lg font-medium mb-2">No files found</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Enter your Discord Channel ID and Token to browse your files, or upload a file first.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}