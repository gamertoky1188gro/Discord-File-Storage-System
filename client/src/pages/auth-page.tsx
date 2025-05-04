import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Laptop, Database, Lock } from "lucide-react";

export default function AuthPage() {
  const [ip, setIp] = useState<string | null>(null);
  const [device, setDevice] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Parse query params to get IP if it exists
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ipParam = params.get('ip');
    if (ipParam) {
      setIp(ipParam);
    }
    
    // Check device and IP information
    fetch('/api/check-ip')
      .then(res => res.json())
      .then(data => {
        if (data.ip) setIp(data.ip);
        if (data.device) setDevice(data.device);
        
        // No automatic redirection to keep "/auth" accessible
        // User data is already available through the data.auth property
      })
      .catch(err => {
        console.error('Error getting IP info:', err);
      });
  }, [navigate]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password,
          stayLoggedIn,
        }),
      });
      
      if (res.ok) {
        toast({
          title: "Login successful",
          description: stayLoggedIn 
            ? "Welcome back! You'll stay logged in on this device."
            : "Welcome back! You'll need to log in again next time.",
        });
        navigate('/');
      } else {
        toast({
          title: "Login failed",
          description: "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login error",
        description: "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Button 
        variant="ghost" 
        className="absolute top-4 left-4 gap-2"
        onClick={() => navigate('/')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to App
      </Button>
      
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Auth form */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-2xl">Authentication Required</CardTitle>
            </div>
            <CardDescription>
              We detected that your IP address has been used before. Please enter your password to continue.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="bg-muted p-3 rounded-md flex items-start gap-3 mb-4">
                  <Laptop className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Device Information</p>
                    <p className="text-sm text-muted-foreground">IP Address: {ip || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">Device: {device || 'Unknown'}</p>
                  </div>
                </div>
              
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="stayLoggedIn" 
                    checked={stayLoggedIn} 
                    onCheckedChange={(checked) => setStayLoggedIn(checked === true)}
                  />
                  <Label 
                    htmlFor="stayLoggedIn" 
                    className="text-sm font-normal cursor-pointer"
                  >
                    Stay logged in
                  </Label>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Info section */}
        <div className="space-y-6 p-4 hidden lg:block">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Discord File Master</h2>
            <p className="text-muted-foreground">
              Upload and download files of any size using Discord as storage.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Unlimited Storage</h3>
                <p className="text-sm text-muted-foreground">
                  Store files of any size by splitting them into manageable chunks.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Secure Access</h3>
                <p className="text-sm text-muted-foreground">
                  Your IP address is used as a secure identifier to protect your files.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}