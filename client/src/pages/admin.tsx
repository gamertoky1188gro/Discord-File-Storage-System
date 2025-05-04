import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangleIcon, FileIcon, ShieldIcon, UsersIcon, ServerIcon, ActivityIcon, LoaderIcon, 
  RefreshCwIcon, Settings2Icon, CheckCircleIcon, XCircleIcon, EyeIcon, MailIcon, SmartphoneIcon, ClockIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Types for admin data
interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalFiles: number;
  storageUsed: number;
  totalRequests: number;
  averageFileSize: number;
}

interface ActivityItem {
  id: number;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  profile: {
    id: number;
    displayName: string;
    theme: string;
    deviceName: string;
    lastActive: string | null;
    email: string | null;
  } | null;
}

interface FileItem {
  id: number;
  filename: string;
  originalFilename: string;
  size: number;
  type: string;
  isPublic: boolean;
  mimeType: string;
  createdAt: string;
}

interface FileStats {
  totalFiles: number;
  fileTypes: {
    normal: number;
    large_chunked: number;
  };
  storageUsedGB: number;
  avgFileSizeMB: number;
  publicFiles: number;
  privateFiles: number;
  recentFiles: FileItem[];
}

interface SystemSettings {
  maxFileSize: number;
  defaultChunkSize: number;
  allowedFileTypes: string;
  serverVersion: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
}

interface LogItem {
  id: number;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  details: any;
  source: string;
}

interface AdminState {
  stats: AdminStats | null;
  activities: ActivityItem[];
  users: User[];
  fileStats: FileStats | null;
  settings: SystemSettings | null;
  logs: LogItem[];
  isLoading: boolean;
  error: Error | null;
}

// Type for creating a new user
interface CreateUserForm {
  username: string;
  password: string;
  email: string;
  deviceName: string;
  isAdmin: boolean;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Create user dialog state
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserForm>({
    username: '',
    password: '',
    email: '',
    deviceName: '',
    isAdmin: false
  });
  
  // The admin password is "123123455" - Hard-coded on client side for now
  const ADMIN_PASSWORD = "123123455";
  
  // Fetch admin stats
  const { 
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      if (!authenticated) return null;
      const response = await axios.get('/api/admin/stats');
      return response.data;
    },
    enabled: authenticated, // Only fetch when authenticated
  });
  
  // Fetch recent activity
  const { 
    data: activityData,
    isLoading: isActivityLoading,
    error: activityError,
    refetch: refetchActivity
  } = useQuery({
    queryKey: ['/api/admin/activity'],
    queryFn: async () => {
      if (!authenticated) return { activities: [] };
      const response = await axios.get('/api/admin/activity');
      return response.data;
    },
    enabled: authenticated, // Only fetch when authenticated
  });
  
  // Default stats if data hasn't loaded yet
  const stats = statsData || {
    totalUsers: 0,
    activeUsers: 0,
    totalFiles: 0,
    storageUsed: 0,
    totalRequests: 0,
    averageFileSize: 0,
  };
  
  // Fetch user data
  const { 
    data: userData,
    isLoading: isUsersLoading,
    error: usersError,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      if (!authenticated) return { users: [] };
      const response = await axios.get('/api/admin/users');
      return response.data;
    },
    enabled: authenticated && activeTab === 'users',
  });
  
  // Fetch file statistics
  const { 
    data: fileStatsData,
    isLoading: isFileStatsLoading,
    error: fileStatsError,
    refetch: refetchFileStats
  } = useQuery({
    queryKey: ['/api/admin/files'],
    queryFn: async () => {
      if (!authenticated) return null;
      const response = await axios.get('/api/admin/files');
      return response.data;
    },
    enabled: authenticated && activeTab === 'files',
  });
  
  // Fetch system settings
  const { 
    data: settingsData,
    isLoading: isSettingsLoading,
    error: settingsError,
    refetch: refetchSettings
  } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      if (!authenticated) return null;
      const response = await axios.get('/api/admin/settings');
      return response.data;
    },
    enabled: authenticated && activeTab === 'settings',
  });
  
  // Fetch system logs
  const { 
    data: logsData,
    isLoading: isLogsLoading,
    error: logsError,
    refetch: refetchLogs
  } = useQuery({
    queryKey: ['/api/admin/logs'],
    queryFn: async () => {
      if (!authenticated) return { logs: [] };
      const response = await axios.get('/api/admin/logs');
      return response.data;
    },
    enabled: authenticated && activeTab === 'logs',
  });
  
  // Default activity if data hasn't loaded yet
  const recentActivity = activityData?.activities || [];
  
  // Default users data if not loaded yet
  const users = userData?.users || [];
  
  // Default file stats if not loaded yet
  const fileStats = fileStatsData || {
    totalFiles: 0,
    fileTypes: { normal: 0, large_chunked: 0 },
    storageUsedGB: 0,
    avgFileSizeMB: 0,
    publicFiles: 0,
    privateFiles: 0,
    recentFiles: []
  };
  
  // Default settings if not loaded yet
  // Settings update mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Settings updated",
        description: "System settings have been successfully updated"
      });
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive"
      });
    }
  });

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editedSettings, setEditedSettings] = useState<any>(null);
  
  // Initialize edited settings when settings data changes
  useEffect(() => {
    if (settingsData) {
      setEditedSettings({
        maxFileSize: settingsData.maxFileSize,
        defaultChunkSize: settingsData.defaultChunkSize,
        allowedFileTypes: settingsData.allowedFileTypes,
        maintenanceMode: settingsData.maintenanceMode,
        registrationEnabled: settingsData.registrationEnabled
      });
    }
  }, [settingsData]);
  
  const settings = settingsData || {
    maxFileSize: 0,
    defaultChunkSize: 0,
    allowedFileTypes: '',
    serverVersion: '',
    maintenanceMode: false,
    registrationEnabled: true
  };
  
  // Default logs if not loaded yet
  const logs = logsData?.logs || [];
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      const response = await apiRequest('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return response;
    },
    onSuccess: () => {
      // Close dialog and reset form
      setShowCreateUserDialog(false);
      setNewUser({
        username: '',
        password: '',
        email: '',
        deviceName: '',
        isAdmin: false
      });
      
      toast({
        title: "User created",
        description: "The user has been successfully created"
      });
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      refetchUsers();
      refetchStats();
    },
    onError: (error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been successfully removed"
      });
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      refetchUsers();
      refetchStats();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Function to handle user form input changes
  const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setNewUser(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Function to handle user creation
  const handleCreateUser = () => {
    // Validate form
    if (!newUser.username.trim()) {
      toast({
        title: "Validation Error",
        description: "Username is required",
        variant: "destructive"
      });
      return;
    }
    
    if (!newUser.password.trim()) {
      toast({
        title: "Validation Error",
        description: "Password is required",
        variant: "destructive"
      });
      return;
    }
    
    // Submit form
    createUserMutation.mutate(newUser);
  };

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      await apiRequest(`/api/admin/files/${fileId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: "File deleted",
        description: "The file has been successfully removed"
      });
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/admin/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      refetchFileStats();
      refetchStats();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle file public status
  const toggleFilePublicMutation = useMutation({
    mutationFn: async (payload: { fileId: number, isPublic: boolean }) => {
      await apiRequest(`/api/admin/files/${payload.fileId}/visibility`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: payload.isPublic })
      });
    },
    onSuccess: () => {
      toast({
        title: "File visibility updated",
        description: "The file visibility has been updated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      refetchFileStats();
      refetchStats();
    },
    onError: (error) => {
      toast({
        title: "Failed to update file visibility",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Function to handle user delete confirmation
  const handleDeleteUser = (userId: number, username: string) => {
    // You could add a confirmation dialog here
    if (confirm(`Are you sure you want to delete user ${username}?`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  // Function to handle file delete confirmation
  const handleDeleteFile = (fileId: number, filename: string) => {
    if (confirm(`Are you sure you want to delete file ${filename}?`)) {
      deleteFileMutation.mutate(fileId);
    }
  };

  // Function to handle file visibility toggle
  const handleToggleFileVisibility = (fileId: number, isCurrentlyPublic: boolean) => {
    toggleFilePublicMutation.mutate({
      fileId,
      isPublic: !isCurrentlyPublic
    });
  };

  // Function to refresh all data based on active tab
  const refreshData = () => {
    refetchStats();
    switch (activeTab) {
      case 'dashboard':
        refetchActivity();
        break;
      case 'users':
        refetchUsers();
        break;
      case 'files':
        refetchFileStats();
        break;
      case 'settings':
        refetchSettings();
        break;
      case 'logs':
        refetchLogs();
        break;
    }
    
    toast({
      title: "Refreshing data",
      description: "Fetching the latest data from the server"
    });
  };
  
  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      toast({
        title: "Authentication successful",
        description: "Welcome to the admin dashboard"
      });
    } else {
      toast({
        title: "Authentication failed",
        description: "Invalid password",
        variant: "destructive"
      });
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Convert to appropriate time units
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return 'Just now';
    }
  };
  
  if (!authenticated) {
    return (
      <div className="container py-12 max-w-md mx-auto">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
            <CardDescription className="text-center">
              Enter your password to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                />
              </div>
              <Button 
                onClick={handleLogin}
                className="w-full"
              >
                Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your Discord File Storage system
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to App
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <UsersIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                {isStatsLoading ? (
                  <div className="flex items-center h-8">
                    <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <h3 className="text-2xl font-bold">{stats.totalUsers}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <FileIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                {isStatsLoading ? (
                  <div className="flex items-center h-8">
                    <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <h3 className="text-2xl font-bold">{stats.totalFiles}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <ServerIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                {isStatsLoading ? (
                  <div className="flex items-center h-8">
                    <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <h3 className="text-2xl font-bold">{stats.storageUsed} GB</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <ActivityIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                {isStatsLoading ? (
                  <div className="flex items-center h-8">
                    <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <h3 className="text-2xl font-bold">{stats.totalRequests}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest actions performed by users in the system
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={isActivityLoading || isStatsLoading || isUsersLoading || 
                         isFileStatsLoading || isSettingsLoading || isLogsLoading}
              >
                {(isActivityLoading || isStatsLoading) ? (
                  <>
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
                    Refresh
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isActivityLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading activity data...</span>
                  </div>
                ) : activityError ? (
                  <div className="flex items-center justify-center h-[400px] text-destructive">
                    <AlertTriangleIcon className="h-8 w-8 mr-2" />
                    <span>Error loading activity data</span>
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    No activity data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity: ActivityItem) => (
                      <div key={activity.id} className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="p-2 bg-muted rounded-full">
                          <ActivityIcon className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium">{activity.user}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(activity.timestamp)}</p>
                          </div>
                          <p className="text-sm">
                            {activity.action}: <span className="font-medium">{activity.target}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  View and manage registered users in the system
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setShowCreateUserDialog(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                  Create User
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshData}
                  disabled={isUsersLoading}
                >
                  {isUsersLoading ? (
                    <>
                      <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon className="h-4 w-4 mr-2" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full">
                {isUsersLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading user data...</span>
                  </div>
                ) : usersError ? (
                  <div className="flex items-center justify-center h-[400px] text-destructive">
                    <AlertTriangleIcon className="h-8 w-8 mr-2" />
                    <span>Error loading user data</span>
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    No users found in the system
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user: User) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {user.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">
                            {user.username}
                            {user.isAdmin && (
                              <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.profile?.deviceName || "Unknown device"}
                          </TableCell>
                          <TableCell>
                            {user.profile?.email || "Unknown IP"}
                          </TableCell>
                          <TableCell>
                            {user.profile?.lastActive ? (
                              <div>
                                <div>{formatDate(user.profile.lastActive)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {getTimeSince(user.profile.lastActive)}
                                </div>
                              </div>
                            ) : "Never"}
                          </TableCell>
                          <TableCell>
                            {user.profile?.lastActive ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <EyeIcon className="h-4 w-4" />
                                <span className="sr-only">View details</span>
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                <span className="sr-only">Edit user</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-100"
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                disabled={deleteUserMutation.isPending}
                              >
                                {deleteUserMutation.isPending && deleteUserMutation.variables === user.id ? (
                                  <LoaderIcon className="h-4 w-4 animate-spin" />
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                )}
                                <span className="sr-only">Delete user</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="files">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle>File Management</CardTitle>
                <CardDescription>
                  Monitor file storage and manage system files
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={isFileStatsLoading}
              >
                {isFileStatsLoading ? (
                  <>
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isFileStatsLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading file data...</span>
                </div>
              ) : fileStatsError ? (
                <div className="flex items-center justify-center h-[400px] text-destructive">
                  <AlertTriangleIcon className="h-8 w-8 mr-2" />
                  <span>Error loading file data</span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{fileStats.totalFiles}</div>
                          <p className="text-sm text-muted-foreground mt-1">Total Files</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{fileStats.storageUsedGB.toFixed(2)} GB</div>
                          <p className="text-sm text-muted-foreground mt-1">Storage Used</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{fileStats.avgFileSizeMB.toFixed(2)} MB</div>
                          <p className="text-sm text-muted-foreground mt-1">Average File Size</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {fileStats.publicFiles} / {fileStats.totalFiles}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Public Files</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">File Type Distribution</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{fileStats.fileTypes.normal}</div>
                            <p className="text-sm text-muted-foreground mt-1">Regular Files</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{fileStats.fileTypes.large_chunked}</div>
                            <p className="text-sm text-muted-foreground mt-1">Large Chunked Files</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Recent Files</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fileStats.recentFiles.length > 0 ? (
                          fileStats.recentFiles.map((file: FileItem) => (
                            <TableRow key={file.id}>
                              <TableCell className="font-medium">{file.originalFilename}</TableCell>
                              <TableCell>{file.type}</TableCell>
                              <TableCell>
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </TableCell>
                              <TableCell>
                                <div className="cursor-pointer" onClick={() => handleToggleFileVisibility(file.id, file.isPublic)}>
                                  {file.isPublic ? (
                                    <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                                      Public
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Private</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatDate(file.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span className="sr-only">Download file</span>
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <path d="M12 16v-4"></path>
                                      <path d="M12 8h.01"></path>
                                    </svg>
                                    <span className="sr-only">File details</span>
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-100"
                                    onClick={() => handleDeleteFile(file.id, file.originalFilename)}
                                    disabled={deleteFileMutation.isPending}
                                  >
                                    {deleteFileMutation.isPending && deleteFileMutation.variables === file.id ? (
                                      <LoaderIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      </svg>
                                    )}
                                    <span className="sr-only">Delete file</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                              No files found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure system-wide settings and parameters
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {isEditingSettings ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        updateSettingsMutation.mutate(editedSettings);
                        setIsEditingSettings(false);
                      }}
                      disabled={isSettingsLoading || updateSettingsMutation.isPending}
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setIsEditingSettings(false);
                        // Reset to original settings
                        if (settingsData) {
                          setEditedSettings({
                            maxFileSize: settingsData.maxFileSize,
                            defaultChunkSize: settingsData.defaultChunkSize,
                            allowedFileTypes: settingsData.allowedFileTypes,
                            maintenanceMode: settingsData.maintenanceMode,
                            registrationEnabled: settingsData.registrationEnabled
                          });
                        }
                      }}
                    >
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsEditingSettings(true)}
                      disabled={isSettingsLoading}
                    >
                      <Settings2Icon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={refreshData}
                      disabled={isSettingsLoading}
                    >
                      {isSettingsLoading ? (
                        <>
                          <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <RefreshCwIcon className="h-4 w-4 mr-2" />
                          Refresh
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isSettingsLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading settings data...</span>
                </div>
              ) : settingsError ? (
                <div className="flex items-center justify-center h-[400px] text-destructive">
                  <AlertTriangleIcon className="h-8 w-8 mr-2" />
                  <span>Error loading settings data</span>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4">File Configuration</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxFileSize">Maximum File Size</Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              id="maxFileSize" 
                              value={isEditingSettings 
                                ? ((editedSettings?.maxFileSize || 0) / (1024 * 1024)).toFixed(0)
                                : (settings.maxFileSize / (1024 * 1024)).toFixed(0)
                              }
                              onChange={(e) => {
                                if (isEditingSettings) {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value)) {
                                    setEditedSettings({
                                      ...editedSettings,
                                      maxFileSize: value * 1024 * 1024 // Convert to bytes
                                    });
                                  }
                                }
                              }}
                              readOnly={!isEditingSettings}
                            />
                            <span className="text-sm text-muted-foreground">MB</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chunkSize">Default Chunk Size</Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              id="chunkSize" 
                              value={isEditingSettings 
                                ? ((editedSettings?.defaultChunkSize || 0) / (1024 * 1024)).toFixed(0)
                                : (settings.defaultChunkSize / (1024 * 1024)).toFixed(0)
                              }
                              onChange={(e) => {
                                if (isEditingSettings) {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value)) {
                                    setEditedSettings({
                                      ...editedSettings,
                                      defaultChunkSize: value * 1024 * 1024 // Convert to bytes
                                    });
                                  }
                                }
                              }}
                              readOnly={!isEditingSettings}
                            />
                            <span className="text-sm text-muted-foreground">MB</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fileTypes">Allowed File Types</Label>
                        <Input 
                          id="fileTypes" 
                          value={settings.allowedFileTypes} 
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">System Configuration</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label 
                            htmlFor="maintenanceMode" 
                            className="text-base"
                          >
                            Maintenance Mode
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Put the system in maintenance mode (no uploads or downloads)
                          </p>
                        </div>
                        <Switch 
                          id="maintenanceMode" 
                          checked={settings.maintenanceMode} 
                          disabled
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label 
                            htmlFor="registrationEnabled" 
                            className="text-base"
                          >
                            User Registration
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Allow new users to register for the system
                          </p>
                        </div>
                        <Switch 
                          id="registrationEnabled" 
                          checked={settings.registrationEnabled} 
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">System Information</h3>
                    <div className="rounded-lg border p-4">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Server Version</span>
                        <span className="font-medium">{settings.serverVersion}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Total Users</span>
                        <span className="font-medium">{stats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Total Files</span>
                        <span className="font-medium">{stats.totalFiles}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Storage Used</span>
                        <span className="font-medium">{stats.storageUsed} GB</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle>System Logs</CardTitle>
                <CardDescription>
                  Monitor system activities and error logs
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={isLogsLoading}
              >
                {isLogsLoading ? (
                  <>
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isLogsLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading logs data...</span>
                </div>
              ) : logsError ? (
                <div className="flex items-center justify-center h-[400px] text-destructive">
                  <AlertTriangleIcon className="h-8 w-8 mr-2" />
                  <span>Error loading logs data</span>
                </div>
              ) : (
                <ScrollArea className="h-[460px]">
                  <div className="space-y-1">
                    {logs.length > 0 ? logs.map((log: LogItem) => (
                      <div 
                        key={log.id} 
                        className={`p-3 rounded-md text-sm ${
                          log.level === 'error' 
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                            : log.level === 'warning'
                              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                              : 'bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {log.level === 'error' ? (
                              <AlertTriangleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                            ) : log.level === 'warning' ? (
                              <AlertTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 8v4"></path>
                                <path d="M12 16h.01"></path>
                              </svg>
                            )}
                            <span className="font-medium">
                              {log.level.charAt(0).toUpperCase() + log.level.slice(1)}
                            </span>
                          </div>
                          <span className="text-xs opacity-70">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                        <p className="ml-6">{log.message}</p>
                        {log.details && (
                          <div className="mt-2 ml-6 p-2 bg-background rounded border text-xs font-mono">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details, null, 2)
                              : String(log.details)
                            }
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                        No logs available
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. All fields are required except where noted.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                value={newUser.username}
                onChange={handleUserFormChange}
                className="col-span-3"
                placeholder="johndoe"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={newUser.password}
                onChange={handleUserFormChange}
                className="col-span-3"
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email/IP
              </Label>
              <Input
                id="email"
                name="email"
                value={newUser.email}
                onChange={handleUserFormChange}
                className="col-span-3"
                placeholder="user@example.com or IP address"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deviceName" className="text-right">
                Device
              </Label>
              <Input
                id="deviceName"
                name="deviceName"
                value={newUser.deviceName}
                onChange={handleUserFormChange}
                className="col-span-3"
                placeholder="Device name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isAdmin" className="text-right">
                Admin
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Checkbox 
                  id="isAdmin" 
                  name="isAdmin"
                  checked={newUser.isAdmin}
                  onCheckedChange={(checked) => {
                    setNewUser(prev => ({
                      ...prev,
                      isAdmin: checked === true
                    }));
                  }}
                />
                <Label htmlFor="isAdmin" className="font-normal">
                  User has admin privileges
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowCreateUserDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Creating...
                </>
              ) : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}