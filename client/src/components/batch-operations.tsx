import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// Types
type BatchOperation = {
  id: number;
  user_id: number;
  operation_type: 'upload' | 'download';
  status: 'pending' | 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
  total_files: number;
  completed_files: number;
  created_at: string;
  completed_at: string | null;
  details: Record<string, any>;
};

type BatchOperationItem = {
  id: number;
  batch_id: number;
  file_id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details: Record<string, any>;
};

type BatchOperationWithItems = BatchOperation & {
  items: BatchOperationItem[];
};

export function BatchOperationCard({ userId }: { userId: number }) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const { toast } = useToast();
  const { lastMessage } = useWebSocket();
  
  // Query for batch operations
  const { 
    data: batchOperations = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['batch-operations', userId],
    queryFn: async () => {
      const response = await apiRequest<{ operations: BatchOperation[] }>(`/api/batch/${userId}`);
      return response.operations;
    },
    enabled: !!userId,
  });
  
  // Query for batch details when selected
  const { 
    data: batchDetails,
    isLoading: isLoadingDetails
  } = useQuery({
    queryKey: ['batch-details', selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return null;
      const response = await apiRequest<{ details: BatchOperationWithItems }>(`/api/batch/details/${selectedBatchId}`);
      return response.details;
    },
    enabled: !!selectedBatchId,
  });
  
  // Filter operations based on active tab
  const filteredOperations = useMemo(() => {
    return batchOperations.filter((op: BatchOperation) => {
      if (activeTab === 'active') {
        return op.status === 'pending' || op.status === 'in_progress';
      } else {
        return op.status === 'completed' || op.status === 'completed_with_errors' || op.status === 'failed';
      }
    });
  }, [batchOperations, activeTab]);
  
  // Listen for WebSocket messages
  useMemo(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (data.type === 'batch_progress' || data.type === 'batch_complete' || data.type === 'batch_error') {
          // Refresh batch operations when we get an update
          refetch();
          
          // Show toast for completion
          if (data.type === 'batch_complete') {
            toast({
              title: 'Batch operation complete',
              description: `${data.total} files processed, ${data.completed} completed successfully`,
              variant: data.completed === data.total ? 'default' : 'destructive',
            });
          }
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    }
  }, [lastMessage, refetch, toast]);
  
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Batch Operations</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
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
          Manage and monitor batch file uploads and downloads
        </CardDescription>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="active" 
            className={activeTab === 'active' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('active')}
          >
            Active
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            className={activeTab === 'completed' ? 'data-[state=active]' : ''} 
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {filteredOperations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="text-4xl mb-4">📦</div>
                <h3 className="text-lg font-medium mb-2">No batch operations</h3>
                <p className="text-muted-foreground text-sm">
                  {activeTab === 'active' 
                    ? 'No active batch operations at the moment.' 
                    : 'Your completed batch operations will appear here.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100%-1rem)]">
                <div className="space-y-3">
                  {filteredOperations.map((operation: BatchOperation) => (
                    <BatchOperationItem 
                      key={operation.id}
                      operation={operation}
                      onClick={() => setSelectedBatchId(operation.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
      
      {/* Batch details dialog */}
      <Dialog open={!!selectedBatchId} onOpenChange={(open) => !open && setSelectedBatchId(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Batch Operation Details</DialogTitle>
            <DialogDescription>
              View details of this batch operation
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : batchDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Operation Type</h4>
                  <p className="capitalize">{batchDetails.operation_type}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                  <BatchStatusBadge status={batchDetails.status} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                  <p>{formatDistanceToNow(new Date(batchDetails.created_at))} ago</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Progress</h4>
                  <p>{batchDetails.completed_files} of {batchDetails.total_files} files</p>
                </div>
              </div>
              
              <Progress 
                value={(batchDetails.completed_files / batchDetails.total_files) * 100} 
                className="w-full h-2" 
              />
              
              <div>
                <h3 className="text-lg font-medium mb-2">Files</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File ID</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchDetails.items.map((item: BatchOperationItem) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.file_id}</TableCell>
                          <TableCell>
                            <BatchStatusBadge status={item.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Could not load batch details
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setSelectedBatchId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BatchOperationItem({ 
  operation,
  onClick
}: { 
  operation: BatchOperation;
  onClick: () => void;
}) {
  const progress = (operation.completed_files / operation.total_files) * 100;
  const isActive = operation.status === 'pending' || operation.status === 'in_progress';
  
  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-shadow hover:shadow-md", 
        isActive ? "border-primary/30" : ""
      )}
      onClick={onClick}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium flex items-center">
            <span className="capitalize">{operation.operation_type}</span>
            <BatchStatusBadge status={operation.status} className="ml-2" />
          </h3>
          <span className="text-xs text-muted-foreground">
            ID: {operation.id}
          </span>
        </div>
        
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span>{operation.completed_files} of {operation.total_files} files</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full h-1.5" />
        </div>
        
        <div className="text-xs text-muted-foreground">
          {isActive ? (
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>
              In progress
            </span>
          ) : (
            <span>
              Completed {formatDistanceToNow(
                new Date(operation.completed_at || operation.created_at)
              )} ago
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function BatchStatusBadge({ 
  status,
  className
}: { 
  status: string;
  className?: string;
}) {
  const getStatusStyles = () => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'completed_with_errors':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'completed_with_errors':
        return 'Partial';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };
  
  return (
    <Badge 
      variant="outline" 
      className={cn("whitespace-nowrap font-normal", getStatusStyles(), className)}
    >
      {getStatusText()}
    </Badge>
  );
}