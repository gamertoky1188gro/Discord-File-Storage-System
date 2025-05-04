import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Download as DownloadIcon,
  File as FileIcon,
  Image as ImageIcon,
  FileText as FileTextIcon,
  FileCode as FileCodeIcon,
  FileArchive as FileArchiveIcon,
  CheckCircle,
  XCircle,
  Copy,
  Maximize2,
  ExternalLink,
  FileType,
  FileJson,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type File = {
  id: number;
  filename: string;
  original_filename: string;
  size: number;
  type: "normal" | "large_chunked";
  upload_complete: boolean;
  is_public: boolean;
  share_id: string;
  created_at: string;
  mime_type: string;
};

interface FileGridProps {
  files: File[];
  onDownload: (filename: string, isLarge: boolean) => void;
  onTogglePublic: (fileId: number, isPublic: boolean) => void;
}

export function FileGrid({ files, onDownload, onTogglePublic }: FileGridProps) {
  const [showCopiedId, setShowCopiedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // Format file size for display
  const formatFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Copy share link to clipboard
  const copyShareLink = (shareId: string) => {
    const shareLink = `${window.location.origin}/shared/${shareId}`;
    navigator.clipboard.writeText(shareLink);
    setShowCopiedId(shareId);
    setTimeout(() => setShowCopiedId(null), 2000);
    toast({
      title: "Link copied",
      description: "The share link has been copied to your clipboard",
    });
  };

  // Determine file icon based on mime type
  const getFileIcon = (file: File) => {
    if (!file.mime_type) return <FileIcon className="h-8 w-8" />;
    
    if (file.mime_type.startsWith("image/")) {
      return <ImageIcon className="h-8 w-8 text-blue-500" />;
    } else if (file.mime_type === "application/pdf") {
      return <FileType className="h-8 w-8 text-red-500" />;
    } else if (file.mime_type.includes("javascript") || file.mime_type.includes("json")) {
      return <FileJson className="h-8 w-8 text-green-500" />;
    } else if (file.mime_type.includes("text/") || file.mime_type.includes("html")) {
      return <FileCodeIcon className="h-8 w-8 text-green-500" />;
    } else if (file.mime_type.includes("zip") || file.mime_type.includes("compressed")) {
      return <FileArchiveIcon className="h-8 w-8 text-yellow-500" />;
    } else if (file.mime_type.includes("text/")) {
      return <FileTextIcon className="h-8 w-8 text-purple-500" />;
    }
    
    return <FileIcon className="h-8 w-8" />;
  };

  // Check if file is previewable
  const isPreviewable = (file: File): boolean => {
    if (!file.mime_type) return false;
    return file.mime_type.startsWith("image/") || 
           file.mime_type === "application/pdf" || 
           file.mime_type.includes("text/");
  };

  // Determine if preview should show image
  const shouldShowImagePreview = (file: File): boolean => {
    return file.mime_type?.startsWith("image/") || false;
  };

  // Generate image preview URL
  const getImagePreviewUrl = (filename: string): string => {
    // In a real app, you would generate a URL to fetch the image
    // For now, we'll assume we need to download it first
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=`;
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="grid" className="w-full">
        <div className="flex justify-end mb-4">
          <TabsList>
            <TabsTrigger value="grid" className="px-3">
              <div className="grid grid-cols-3 gap-0.5 h-4 w-4 mr-2"></div>
              Grid
            </TabsTrigger>
            <TabsTrigger value="list" className="px-3">
              <div className="flex flex-col gap-0.5 h-4 w-4 mr-2">
                <div className="h-0.5 bg-current"></div>
                <div className="h-0.5 bg-current"></div>
                <div className="h-0.5 bg-current"></div>
              </div>
              List
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.id} className="overflow-hidden flex flex-col">
                <div className="relative p-4 flex-grow flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 h-40">
                  {file.type === "large_chunked" && (
                    <Badge 
                      variant="secondary" 
                      className="absolute top-2 right-2"
                    >
                      Large File
                    </Badge>
                  )}
                  
                  {file.is_public && (
                    <Badge 
                      className="absolute top-2 left-2 bg-green-600"
                    >
                      Public
                    </Badge>
                  )}
                  
                  {getFileIcon(file)}
                  <h3 className="mt-3 text-center font-medium text-sm truncate max-w-full px-2">
                    {file.filename}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatFileSize(file.size)}
                  </p>
                  
                  {isPreviewable(file) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute bottom-2 right-2"
                      onClick={() => setPreviewFile(file)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <CardFooter className="flex justify-between p-2 bg-white dark:bg-gray-800 border-t">
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDownload(file.filename, file.type === "large_chunked")}
                      title="Download"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant={file.is_public ? "default" : "outline"}
                      size="icon"
                      className={cn(
                        "h-8 w-8", 
                        file.is_public && "bg-green-600 hover:bg-green-700"
                      )}
                      onClick={() => onTogglePublic(file.id, !file.is_public)}
                      title={file.is_public ? "Make private" : "Make public"}
                    >
                      {file.is_public ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {file.is_public && (
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        showCopiedId === file.share_id && "bg-green-100 dark:bg-green-900"
                      )}
                      onClick={() => copyShareLink(file.share_id)}
                      title="Copy share link"
                    >
                      {showCopiedId === file.share_id ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
            
            {files.length === 0 && (
              <div className="col-span-full text-center py-12">
                <FileIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No files found</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="list" className="mt-0">
          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-12 bg-muted p-2 text-xs font-medium">
              <div className="col-span-5">Filename</div>
              <div className="col-span-2 text-center">Size</div>
              <div className="col-span-2 text-center">Type</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>
            
            <div className="divide-y">
              {files.map((file) => (
                <div key={file.id} className="grid grid-cols-12 p-2 items-center hover:bg-muted/50 text-sm">
                  <div className="col-span-5 flex items-center gap-2 truncate">
                    {getFileIcon(file)}
                    <span className="truncate">{file.filename}</span>
                  </div>
                  <div className="col-span-2 text-center">{formatFileSize(file.size)}</div>
                  <div className="col-span-2 text-center">
                    <Badge variant={file.type === "large_chunked" ? "secondary" : "outline"}>
                      {file.type === "large_chunked" ? "Large" : "Normal"}
                    </Badge>
                  </div>
                  <div className="col-span-3 flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDownload(file.filename, file.type === "large_chunked")}
                      title="Download"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant={file.is_public ? "default" : "outline"}
                      size="icon"
                      className={cn(
                        "h-8 w-8", 
                        file.is_public && "bg-green-600 hover:bg-green-700"
                      )}
                      onClick={() => onTogglePublic(file.id, !file.is_public)}
                      title={file.is_public ? "Make private" : "Make public"}
                    >
                      {file.is_public ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {file.is_public && (
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          showCopiedId === file.share_id && "bg-green-100 dark:bg-green-900"
                        )}
                        onClick={() => copyShareLink(file.share_id)}
                        title="Copy share link"
                      >
                        {showCopiedId === file.share_id ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    
                    {isPreviewable(file) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPreviewFile(file)}
                        title="Preview"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {files.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No files found</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewFile && getFileIcon(previewFile)}
              <span className="truncate max-w-md">{previewFile?.filename}</span>
              <Badge className="ml-2">
                {formatFileSize(previewFile?.size || 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-6 flex flex-col items-center justify-center min-h-[300px] bg-gray-50 dark:bg-gray-800/50 rounded-md p-4">
            {previewFile && shouldShowImagePreview(previewFile) ? (
              <div className="flex flex-col items-center">
                <img
                  src={getImagePreviewUrl(previewFile.filename)}
                  alt={previewFile.filename}
                  className="max-h-[60vh] max-w-full object-contain rounded-md"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' ry='5'%3E%3C/rect%3E%3Cpath d='M8 12h8'%3E%3C/path%3E%3Cpath d='M12 8v8'%3E%3C/path%3E%3C/svg%3E";
                  }}
                />
                <p className="text-sm text-muted-foreground mt-4">
                  Image Preview
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {getFileIcon(previewFile || { mime_type: "" } as File)}
                <p className="text-lg font-medium mt-4">Preview not available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This file type cannot be previewed directly. Download to view content.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setPreviewFile(null)}
            >
              Close
            </Button>
            {previewFile && (
              <Button
                variant="default"
                onClick={() => onDownload(previewFile.filename, previewFile.type === "large_chunked")}
                className="bg-cyber-purple hover:bg-cyber-light-purple"
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}