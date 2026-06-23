import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";

export function OfflineIndicator() {
  const { isOffline, isSyncing, pendingCount, syncPendingOperations } = useOfflineSync();

  return (
    <AnimatePresence>
      {(isOffline || pendingCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-sm"
          style={{
            backgroundColor: isOffline ? 'hsl(var(--destructive))' : 'hsl(var(--warning))',
            color: isOffline ? 'hsl(var(--destructive-foreground))' : 'hsl(var(--warning-foreground))',
          }}
        >
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>You're offline. Changes will sync when connected.</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <CloudOff className="h-4 w-4" />
              <span>{pendingCount} pending change{pendingCount > 1 ? 's' : ''}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 ml-2"
                onClick={syncPendingOperations}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
