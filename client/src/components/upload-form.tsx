import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, Upload as UploadIcon, Key, Hash, Database } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { UploadProgress, type UploadStatus } from '@/components/ui/upload-progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const uploadFormSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  channel_id: z.string().min(1, 'Channel ID is required'),
  channel_name: z.string().optional(),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

interface UploadFormProps {
  onCredentialsEntered?: (channelId: string, token: string) => void;
}

export function UploadForm({ onCredentialsEntered }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      token: '',
      channel_id: '',
      channel_name: '',
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

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);

  const onSubmit = async (data: UploadFormValues) => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError(undefined);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', data.token);
      formData.append('channel_id', data.channel_id);
      
      // Add optional channel name if provided
      if (data.channel_name) {
        formData.append('channel_name', data.channel_name);
      }

      // Check if it's a large file that will be chunked
      const isLargeFile = file.size > 10 * 1024 * 1024; // > 10MB

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      // Create a promise to handle the XMLHttpRequest
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || 'Upload failed'));
            } catch (e) {
              reject(new Error('Upload failed'));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
      });

      // Open and send the request
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
      
      // Once upload is complete, show processing state for large files
      if (isLargeFile) {
        setUploadStatus('processing');
      }
      
      // Wait for the upload to complete
      const responseData = await uploadPromise;
      
      setUploadStatus('success');
      toast({
        title: "Success!",
        description: "File uploaded successfully to Discord!",
        variant: "default",
        className: "bg-cyber-success text-white",
      });
      
      // Notify parent about the credentials
      onCredentialsEntered?.(data.channel_id, data.token);
      
      // Reset file input after success
      setTimeout(() => {
        setFile(null);
        setUploadStatus('idle');
        setIsUploading(false);
      }, 3000);
      
    } catch (error) {
      setUploadStatus('error');
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
      setUploadError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex items-center mb-6 gap-2">
          <UploadIcon className="h-5 w-5 text-cyber-purple" />
          <h2 className="text-xl font-bold text-cyber-dark dark:text-white">Upload to Discord</h2>
        </div>
        
        {/* File Upload Field */}
        <div className="mb-6">
          <FormLabel className="block text-sm font-medium mb-2 dark:text-gray-200">Select File</FormLabel>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-4 border border-gray-100 dark:border-gray-700">
            <FileUpload onChange={setFile} />
            
            {/* Display file information if selected */}
            {file && uploadStatus === 'idle' && (
              <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 bg-cyber-purple/10 dark:bg-cyber-purple/20 rounded-full p-2">
                    <Database className="h-4 w-4 text-cyber-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {file.size < 1024 * 1024
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                      {file.size > 10 * 1024 * 1024 && 
                        " (Will be split into chunks)"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Upload Progress */}
            {uploadStatus !== 'idle' && file && (
              <div className="mt-4">
                <UploadProgress 
                  status={uploadStatus}
                  progress={uploadProgress}
                  filename={file.name}
                  error={uploadError}
                  isLarge={file.size > 10 * 1024 * 1024}
                />
              </div>
            )}
          </div>
        </div>
        
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
                    className="w-full pl-3 pr-10 py-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 rounded-md focus:ring-cyber-purple focus:border-cyber-purple"
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
                  className="w-full pl-3 py-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 rounded-md focus:ring-cyber-purple focus:border-cyber-purple"
                  placeholder="Enter Discord channel ID"
                  {...field}
                />
              </FormControl>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">The Discord channel where files will be uploaded</p>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Submit Button */}
        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={isUploading || !file || !form.formState.isValid}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload to Discord"
          )}
        </Button>
      </form>
    </Form>
  );
}
