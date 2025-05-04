import React, { useState, useRef } from 'react';
import { X, FileText, Upload, Cloud } from 'lucide-react';

interface FileUploadProps {
  onChange: (file: File | null) => void;
}

export function FileUpload({ onChange }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    onChange(selectedFile);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const onRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-cyber-purple' : 'border-gray-200 dark:border-gray-700'
      } hover:border-cyber-purple`}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={onSelectFile}
      />

      {!file ? (
        <div className="flex flex-col items-center">
          <div className="bg-cyber-purple/10 dark:bg-cyber-purple/20 w-16 h-16 rounded-full flex items-center justify-center mb-3">
            <Cloud className="h-8 w-8 text-cyber-purple" />
          </div>
          <p className="text-cyber-dark dark:text-white font-medium">
            Drag and drop file here or <span className="text-cyber-purple">browse</span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Any file type supported</p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-cyber-purple/10 dark:bg-cyber-purple/20 w-12 h-12 rounded-full flex items-center justify-center mr-3">
              <FileText className="h-6 w-6 text-cyber-purple" />
            </div>
            <div className="overflow-hidden text-left">
              <p className="font-medium text-sm truncate text-cyber-dark dark:text-white">{file.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onRemoveFile}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
