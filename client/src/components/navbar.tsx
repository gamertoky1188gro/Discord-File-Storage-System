import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };
  
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <div className="mr-4 flex">
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer">
              <div className="font-bold text-xl bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
                DiscordFileStorage
              </div>
            </div>
          </Link>
        </div>
        
        <nav className="flex items-center gap-4">
          <Link href="/">
            <div className="text-sm font-medium transition-colors hover:text-primary cursor-pointer">
              Home
            </div>
          </Link>
          <Link href="/profile">
            <div className="text-sm font-medium transition-colors hover:text-primary cursor-pointer">
              Profile
            </div>
          </Link>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </Button>
        </nav>
      </div>
    </header>
  );
}