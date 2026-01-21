import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  hideNav?: boolean;
}

export function AppLayout({ children, title, hideNav }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <Header title={title} />
      <main className={hideNav ? "pb-4" : "pb-24"}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
