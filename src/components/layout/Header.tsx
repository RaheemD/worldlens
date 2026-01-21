import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Globe, Bell, User, Sun, Moon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { useAIUsage } from "@/contexts/AIUsageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const { remaining, limit, isAuthenticated: aiIsAuthenticated, canUseAI } = useAIUsage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(null);

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Support legacy /auth redirects: open AuthDialog when `?auth=1` is present.
  // If a protected route redirected here, we also capture `location.state.from` so we can
  // return the user to the original page after they sign in.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantsAuth = params.get("auth") === "1";
    if (!wantsAuth) return;

    if (!user) {
      const from = (location.state as any)?.from as { pathname?: string; search?: string } | undefined;
      if (from?.pathname) {
        setRedirectAfterAuth(`${from.pathname}${from.search ?? ""}`);
      }

      setAuthDialogOpen(true);
      // Clear the query param to avoid repeatedly re-opening the dialog.
      navigate({ pathname: location.pathname, search: "" }, { replace: true, state: location.state });
    }
  }, [location.pathname, location.search, location.state, navigate, user]);

  useEffect(() => {
    if (!user || !redirectAfterAuth) return;
    navigate(redirectAfterAuth, { replace: true });
    setRedirectAfterAuth(null);
  }, [navigate, redirectAfterAuth, user]);

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <Globe className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            {title || "WorldLens"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* AI Usage Badge */}
          <div 
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mr-1",
              !canUseAI 
                ? "bg-destructive/20 text-destructive" 
                : remaining <= 1 
                  ? "bg-warning/20 text-warning" 
                  : "bg-primary/20 text-primary"
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>{remaining}/{limit}</span>
            {!aiIsAuthenticated && remaining < limit && (
              <span className="hidden sm:inline text-[10px] opacity-70">• sign in for more</span>
            )}
          </div>

          {/* Show avatar when authenticated */}
          {user && (
            <Avatar 
              className="h-8 w-8 border-2 border-primary/30 cursor-pointer"
              onClick={() => navigate("/settings")}
            >
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || "User"} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          )}

          <Button
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-xl"
            onClick={toggleTheme}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
            <Bell className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-xl"
            onClick={() => {
              if (user) {
                navigate("/settings");
              } else {
                setRedirectAfterAuth("/settings");
                setAuthDialogOpen(true);
              }
            }}
          >
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Auth Dialog */}
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </header>
  );
}
