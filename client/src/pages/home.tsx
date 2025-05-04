import { useState, useEffect } from 'react';
import { OperationSelector, OperationType } from '@/components/ui/operation-selector';
import { UploadForm } from '@/components/upload-form';
import { DownloadForm } from '@/components/download-form';
import { FileBrowserCard } from '@/components/file-browser-simple';
import { Layers, Code, Zap, Database, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [selectedOperation, setSelectedOperation] = useState<OperationType>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string>('');
  const [currentToken, setCurrentToken] = useState<string>('');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const { toast } = useToast();

  // Function to handle download from file browser
  const handleDownloadFromBrowser = (filename: string, isLarge: boolean) => {
    if (!currentChannelId || !currentToken) {
      toast({
        title: "Cannot download",
        description: "Channel ID and token are required. Please enter them in the Download form.",
        variant: "destructive",
      });
      setSelectedOperation('download');
      return;
    }

    // Set up form with values
    if (selectedOperation !== 'download') {
      setSelectedOperation('download');
      
      // Wait for operation to change, then trigger download
      setTimeout(() => {
        toast({
          title: "Ready to download",
          description: `Click download to get the file: ${filename}`,
        });
      }, 500);
    }
  };

  // Track form values for file browser
  const updateFormValues = (channelId: string, token: string) => {
    setCurrentChannelId(channelId);
    setCurrentToken(token);
    setShowFileBrowser(!!channelId && !!token);
  };

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    // Initialize WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'file_uploaded') {
          toast({
            title: "New file uploaded",
            description: `${data.data.filename} was added to channel`,
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      socket.close();
    };
  }, [toast]);

  return (
    <div className="flex flex-col items-center py-8 px-4 md:px-6 lg:px-8 min-h-screen relative">
      {/* Header with Theme Toggle */}
      <header className="w-full max-w-2xl flex flex-col items-center justify-center mb-8 relative">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>
        
        <div className="flex items-center mb-3 gap-2">
          <Code className="h-6 w-6 text-cyber-purple" />
          <h1 className={cn(
            "text-3xl md:text-4xl font-bold",
            "text-cyber-gradient"
          )}>Discord File Master</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyber-light-purple" />
          <p className="text-sm md:text-base text-cyber-dark dark:text-white/80">
            Upload and download large files through Discord channels
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl">
        <Tabs defaultValue="operations" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="operations" className="text-sm md:text-base">
              <Layers className="h-4 w-4 mr-2" />
              Operations
            </TabsTrigger>
            <TabsTrigger 
              value="browser" 
              className="text-sm md:text-base"
              disabled={!showFileBrowser}
            >
              <Database className="h-4 w-4 mr-2" />
              File Browser
              {!showFileBrowser && (
                <div className="ml-2 text-xs text-gray-500 flex items-center">
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Enter credentials first
                </div>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="operations">
            <div className="bg-white dark:bg-[#1a1a2e] rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-[#2d2b55]">
              {/* Operation Selector */}
              <div className="bg-cyber-gradient p-5 relative">
                <OperationSelector onChange={setSelectedOperation} />
              </div>

              {/* Form Container */}
              <div className="p-6 bg-white dark:bg-gradient-to-b dark:from-[#1a1a2e] dark:to-[#16162a]">
                {selectedOperation === 'upload' && <UploadForm onCredentialsEntered={updateFormValues} />}
                {selectedOperation === 'download' && <DownloadForm onCredentialsEntered={updateFormValues} />}
                
                {/* No Selection Message */}
                {selectedOperation === null && (
                  <div className="py-12 text-center">
                    <div className="bg-cyber-purple/10 dark:bg-cyber-purple/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Layers className="h-10 w-10 text-cyber-purple" />
                    </div>
                    <h3 className="text-xl font-semibold text-cyber-dark dark:text-white mb-3">Select an Operation</h3>
                    <p className="text-cyber-gray dark:text-gray-300">Choose either Upload or Download from the dropdown menu</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="browser">
            {showFileBrowser ? (
              <div className="bg-white dark:bg-[#1a1a2e] p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4">File Browser</h3>
                <p className="text-muted-foreground mb-4">
                  Connected to Discord channel: {currentChannelId}
                </p>
                
                <div className="border rounded-md p-4 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Storage Used: 2.5 GB of 10 GB</span>
                    <span>25%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full" style={{width: '25%'}}></div>
                  </div>
                </div>
                
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Database className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h4 className="text-lg font-medium mb-2">No files found</h4>
                  <p className="text-muted-foreground">
                    Upload files first to see them listed here
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1a1a2e] p-8 rounded-xl text-center shadow-lg">
                <Database className="h-16 w-16 text-cyber-purple mx-auto mb-4 opacity-40" />
                <h3 className="text-xl font-semibold text-cyber-dark dark:text-white mb-3">File Browser Not Available</h3>
                <p className="text-cyber-gray dark:text-gray-300 mb-6">
                  Enter your Discord credentials in the Upload or Download forms to browse files
                </p>
                <Button 
                  variant="default" 
                  onClick={() => setSelectedOperation('upload')}
                  className="mx-auto"
                >
                  Go to Upload Form
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-10 text-center text-cyber-gray dark:text-gray-400 text-sm">
        <p>Safely transfer files through Discord • <span className="text-cyber-purple">Cyber Code Master</span></p>
      </footer>
    </div>
  );
}
