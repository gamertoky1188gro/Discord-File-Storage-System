import { useState } from 'react';
import { useProfile, type FileOperation } from '@/hooks/use-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelative } from 'date-fns';
import { cn } from '@/lib/utils';

export function FileHistoryCard() {
  const { recentOperations, isOperationsLoading, refreshOperations } = useProfile();
  const [activeTab, setActiveTab] = useState<'all' | 'uploads' | 'downloads'>('all');
  
  // Filter operations based on active tab
  const filteredOperations = activeTab === 'all' 
    ? recentOperations 
    : recentOperations.filter(op => {
        if (activeTab === 'uploads') return op.operation_type === 'upload';
        if (activeTab === 'downloads') return op.operation_type === 'download';
        return true;
      });
  
  // Function to get relative time
  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatRelative(date, new Date());
    } catch (e) {
      return 'Unknown time';
    }
  };
  
  // Function to get operation icon
  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        );
      case 'download':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        );
    }
  };
  
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>File Operations History</span>
          <Button variant="outline" size="sm" onClick={() => refreshOperations()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Your recent file upload and download activity
        </CardDescription>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger 
            value="all" 
            className={activeTab === 'all' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('all')}
          >
            All
          </TabsTrigger>
          <TabsTrigger 
            value="uploads" 
            className={activeTab === 'uploads' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('uploads')}
          >
            Uploads
          </TabsTrigger>
          <TabsTrigger 
            value="downloads" 
            className={activeTab === 'downloads' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('downloads')}
          >
            Downloads
          </TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        {isOperationsLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {filteredOperations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium mb-2">No operation history</h3>
                <p className="text-muted-foreground text-sm">
                  {activeTab === 'all' 
                    ? 'Your file operation history will appear here.' 
                    : `You haven't ${activeTab === 'uploads' ? 'uploaded' : 'downloaded'} any files yet.`}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100%-1rem)]">
                <div className="space-y-3">
                  {filteredOperations.map((operation) => (
                    <OperationItem 
                      key={operation.id}
                      operation={operation}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OperationItem({ operation }: { operation: FileOperation }) {
  const operationType = operation.operation_type;
  const timestamp = getRelativeTime(operation.timestamp);
  
  // Get styling based on operation type
  const getOperationColor = (type: string) => {
    switch (type) {
      case 'upload':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'download':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };
  
  // Get operation icon
  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        );
      case 'download':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        );
    }
  };
  
  // Check if operation has encryption details
  const isEncrypted = operation.details && operation.details.encrypted;
  
  return (
    <Card className="p-4">
      <div className="flex items-start">
        <div className={cn("p-2 rounded-full mr-3", getOperationColor(operationType))}>
          {getOperationIcon(operationType)}
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-medium capitalize">
              {operationType}
              {isEncrypted && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex ml-2 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      This file was encrypted
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </h3>
            <Badge 
              variant="outline" 
              className="text-xs ml-2 whitespace-nowrap"
            >
              File ID: {operation.file_id}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {timestamp}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Helper function to format relative time
function getRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString);
    return formatRelative(date, new Date());
  } catch (e) {
    return 'Unknown time';
  }
}