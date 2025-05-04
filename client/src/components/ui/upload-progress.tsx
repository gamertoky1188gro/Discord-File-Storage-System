import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface UploadProgressProps {
  status: UploadStatus;
  progress: number;
  filename: string;
  error?: string;
  isLarge?: boolean;
}

export function UploadProgress({ 
  status, 
  progress, 
  filename, 
  error,
  isLarge = false
}: UploadProgressProps) {
  const [showPulse, setShowPulse] = useState(false);

  // Pulsing effect for processing state
  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setShowPulse(prev => !prev);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [status]);

  // Display the right status message
  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return 'Ready to upload';
      case 'uploading':
        return isLarge 
          ? `Uploading file in chunks (${Math.round(progress)}%)` 
          : `Uploading file (${Math.round(progress)}%)`;
      case 'processing':
        return isLarge 
          ? 'Processing chunks and finalizing upload...' 
          : 'Processing file...';
      case 'success':
        return 'Upload complete!';
      case 'error':
        return error || 'Upload failed';
      default:
        return '';
    }
  };

  // Truncate filename if too long
  const displayFilename = filename.length > 40
    ? filename.substring(0, 20) + '...' + filename.substring(filename.length - 18)
    : filename;

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate max-w-[240px]" title={filename}>
          {displayFilename}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {status === 'uploading' && `${Math.round(progress)}%`}
          {status === 'processing' && (
            <span className="flex items-center">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Processing
            </span>
          )}
          {status === 'success' && (
            <span className="flex items-center text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center text-red-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Failed
            </span>
          )}
        </span>
      </div>

      <div className="relative">
        <Progress 
          value={status === 'uploading' ? progress : status === 'success' ? 100 : 0} 
          className={cn(
            status === 'error' && "bg-red-200 [&>div]:bg-red-600",
            status === 'success' && "bg-green-200 [&>div]:bg-green-600",
            status === 'processing' && "bg-blue-200",
            status === 'idle' && "bg-gray-200"
          )}
        />
        
        {status === 'processing' && (
          <div 
            className={cn(
              "absolute top-0 left-0 h-full transition-all duration-500 ease-in-out bg-blue-500",
              showPulse ? "w-[70%] opacity-80" : "w-[30%] opacity-60"
            )}
          />
        )}
      </div>
      
      <p className="text-xs mt-1 text-muted-foreground">
        {getStatusMessage()}
      </p>
    </div>
  );
}