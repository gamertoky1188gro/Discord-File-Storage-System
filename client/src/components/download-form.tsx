import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, Download as DownloadIcon, Key, Hash, File as FileIcon, FileCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UploadProgress, type UploadStatus } from '@/components/ui/upload-progress';

const downloadFormSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  large: z.enum(['true', 'false']),
  token: z.string().min(1, 'Token is required'),
  channel_id: z.string().min(1, 'Channel ID is required'),
});

type DownloadFormValues = z.infer<typeof downloadFormSchema>;

interface DownloadFormProps {
  onCredentialsEntered?: (channelId: string, token: string) => void;
}

export function DownloadForm({ onCredentialsEntered }: DownloadFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<UploadStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | undefined>(undefined);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const { toast } = useToast();

  const form = useForm<DownloadFormValues>({
    resolver: zodResolver(downloadFormSchema),
    defaultValues: {
      filename: '',
      large: 'false',
      token: '',
      channel_id: '',
    },
    mode: 'onChange',
  });

  // Pass credentials to parent component when they're entered
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if ((name === 'token' || name === 'channel_id' || !name) && 
          value.token && 
          value.channel_id && 
          form.formState.isValid) {
        onCredentialsEntered?.(value.channel_id, value.token);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, onCredentialsEntered]);

  const onSubmit = async (data: DownloadFormValues) => {
    setIsDownloading(true);
    setDownloadStatus('uploading'); // Using 'uploading' for download progress too
    setDownloadProgress(0);
    setDownloadError(undefined);
    setCurrentFilename(data.filename);
    
    // Check if it's a large file that will need processing
    const isLargeFile = data.large === 'true';
    
    try {
      // Create a form object to hold the request parameters
      const requestBody = {
        filename: data.filename,
        large: isLargeFile,
        token: data.token,
        channel_id: data.channel_id,
      };
      
      // For simulating download progress
      const startDownloadProgress = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 5;
          if (progress > 100) progress = 100;
          setDownloadProgress(progress);
          
          if (progress === 100) {
            clearInterval(interval);
            if (isLargeFile) {
              setDownloadStatus('processing');
            }
          }
        }, 200);
        return interval;
      };
      
      // Start progress simulation
      const progressInterval = startDownloadProgress();
      
      try {
        // Make a direct fetch request with proper options
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        // Clear the progress interval once response is received
        clearInterval(progressInterval);
        
        if (response.ok) {
          setDownloadProgress(100);
          
          // If large file, show processing state briefly
          if (isLargeFile) {
            setDownloadStatus('processing');
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // For file downloads, we need to handle the blob response
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          // Create an anchor element and trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename;
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          setDownloadStatus('success');
          
          toast({
            title: "Success!",
            description: "File downloaded successfully!",
            variant: "default",
            className: "bg-cyber-success text-white",
          });
          
          // Notify parent about the credentials
          onCredentialsEntered?.(data.channel_id, data.token);
          
          // Reset after showing success
          setTimeout(() => {
            setDownloadStatus('idle');
            setIsDownloading(false);
          }, 3000);
        } else {
          setDownloadStatus('error');
          const errorData = await response.json();
          const errorMessage = errorData.message || 'Failed to download file';
          setDownloadError(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (error) {
        clearInterval(progressInterval);
        setDownloadStatus('error');
        const errorMessage = error instanceof Error ? error.message : "Failed to download file";
        setDownloadError(errorMessage);
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        
        setIsDownloading(false);
      }
    } catch (error) {
      setDownloadStatus('error');
      const errorMessage = error instanceof Error ? error.message : "Failed to download file";
      setDownloadError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      setIsDownloading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex items-center mb-6 gap-2">
          <DownloadIcon className="h-5 w-5 text-cyber-light-purple" />
          <h2 className="text-xl font-bold text-cyber-dark dark:text-white">Download from Discord</h2>
        </div>
        
        {/* Filename Field */}
        <FormField
          control={form.control}
          name="filename"
          render={({ field }) => (
            <FormItem className="mb-6">
              <FormLabel className="flex items-center gap-1.5 text-sm font-medium mb-2 dark:text-gray-200">
                <FileIcon className="h-3.5 w-3.5 text-cyber-purple" />
                Filename
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="w-full px-3 py-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white rounded-md focus:ring-cyber-purple focus:border-cyber-purple"
                  placeholder="Enter exact filename to download"
                  {...field}
                />
              </FormControl>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Exact filename as it appears in Discord</p>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Large File Toggle */}
        <FormField
          control={form.control}
          name="large"
          render={({ field }) => (
            <FormItem className="mb-6">
              <FormLabel className="flex items-center gap-1.5 text-sm font-medium mb-2 dark:text-gray-200">
                <FileCheck className="h-3.5 w-3.5 text-cyber-purple" />
                Large File
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="w-full border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white rounded-md focus:ring-cyber-purple focus:border-cyber-purple">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem className="dark:text-white dark:focus:bg-cyber-purple/20" value="false">False</SelectItem>
                  <SelectItem className="dark:text-white dark:focus:bg-cyber-purple/20" value="true">True</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set to 'true' for files larger than 8MB</p>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Token Field */}
        <FormField
          control={form.control}
          name="token"
          render={({ field }) => (
            <FormItem className="mb-6">
              <FormLabel className="flex items-center gap-1.5 text-sm font-medium mb-2 dark:text-gray-200">
                <Key className="h-3.5 w-3.5 text-cyber-purple" />
                Discord Token
              </FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-3 pr-10 py-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white rounded-md focus:ring-cyber-purple focus:border-cyber-purple"
                    placeholder="Enter your bot token"
                    {...field}
                  />
                </FormControl>
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-cyber-purple transition-colors"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Your Discord bot or user token</p>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Channel ID Field */}
        <FormField
          control={form.control}
          name="channel_id"
          render={({ field }) => (
            <FormItem className="mb-6">
              <FormLabel className="flex items-center gap-1.5 text-sm font-medium mb-2 dark:text-gray-200">
                <Hash className="h-3.5 w-3.5 text-cyber-purple" />
                Channel ID
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="w-full pl-3 py-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white rounded-md focus:ring-cyber-purple focus:border-cyber-purple"
                  placeholder="Enter Discord channel ID"
                  {...field}
                />
              </FormControl>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">The Discord channel where file is located</p>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Download Progress */}
        {downloadStatus !== 'idle' && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-100 dark:border-gray-700">
            <UploadProgress 
              status={downloadStatus}
              progress={downloadProgress}
              filename={currentFilename}
              error={downloadError}
              isLarge={form.getValues().large === 'true'}
            />
          </div>
        )}
        
        {/* Submit Button */}
        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={isDownloading || !form.formState.isValid}
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Downloading...
            </>
          ) : (
            "Download from Discord"
          )}
        </Button>
      </form>
    </Form>
  );
}
