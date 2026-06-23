import { ReactNode, useEffect, useState } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  hideNav?: boolean;
}

export function AppLayout({ children, title, hideNav }: AppLayoutProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [bannerMode, setBannerMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setBannerMode("android");
      setShowInstall(true);
    };
    const onInstalled = () => {
      setShowInstall(false);
      setDeferredPrompt(null);
      setBannerMode(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari does not fire beforeinstallprompt; show instructions banner
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (isIOS && !isStandalone) {
      setBannerMode("ios");
      setShowInstall(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShowInstall(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <Header title={title} />
      {showInstall && !hideNav && bannerMode && (
        <div className="fixed bottom-16 left-4 right-4 z-40 rounded-xl border border-border/50 glass p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="Install" className="h-8 w-8 rounded-lg" />
            <div>
              <p className="text-sm font-semibold">Install WorldLens</p>
              {bannerMode === "android" ? (
                <p className="text-xs text-muted-foreground">Add to your home screen</p>
              ) : (
                <p className="text-xs text-muted-foreground">Tap share → Add to Home Screen</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowInstall(false)}>Later</Button>
            {bannerMode === "android" ? (
              <Button size="sm" onClick={handleInstall}>Install</Button>
            ) : (
              <Button size="sm" onClick={() => setShowInstall(false)}>OK</Button>
            )}
          </div>
        </div>
      )}
      <main className={hideNav ? "pb-4" : "pb-24"}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
