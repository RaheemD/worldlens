import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  initOfflineDB, 
  getPendingOperations, 
  clearPendingOperation,
  cacheScan,
  getCachedScans,
  isOnline 
} from '@/lib/offlineStorage';
import { toast } from 'sonner';

export function useOfflineSync() {
  const { user } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Initialize IndexedDB
  useEffect(() => {
    initOfflineDB().catch(console.error);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online! Syncing data...');
      syncPendingOperations();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('You are offline. Changes will sync when connected.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending operations when coming back online
  const syncPendingOperations = useCallback(async () => {
    if (!user || !isOnline()) return;

    setIsSyncing(true);
    try {
      const pending = await getPendingOperations();
      setPendingCount(pending.length);

      for (const op of pending) {
        try {
          if (op.table === 'scan_entries') {
            if (op.type === 'update') {
              const { id, ...updateData } = op.data as { id: string; [key: string]: unknown };
              await supabase
                .from('scan_entries')
                .update(updateData)
                .eq('id', id);
            }
          }
          await clearPendingOperation(op.id);
          setPendingCount(prev => prev - 1);
        } catch (error) {
          console.error('Failed to sync operation:', error);
        }
      }

      if (pending.length > 0) {
        toast.success('Offline changes synced successfully!');
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Cache scans from server for offline access
  const cacheScansForOffline = useCallback(async (scans: Array<{
    id: string;
    category: string;
    name: string | null;
    description: string | null;
    location_name: string | null;
    image_url: string | null;
    extracted_text: string | null;
    ai_analysis: Record<string, unknown> | null;
    is_favorite: boolean;
    created_at: string;
  }>) => {
    for (const scan of scans) {
      try {
        // Cache image as base64 for offline access
        let imageData: string | null = null;
        if (scan.image_url && isOnline()) {
          try {
            const response = await fetch(scan.image_url);
            const blob = await response.blob();
            imageData = await blobToBase64(blob);
          } catch {
            // Image fetch failed, skip caching image
          }
        }

        await cacheScan({
          ...scan,
          image_data: imageData,
        });
      } catch (error) {
        console.error('Failed to cache scan:', error);
      }
    }
  }, []);

  // Get cached scans when offline
  const getOfflineScans = useCallback(async () => {
    return getCachedScans();
  }, []);

  // Check pending operations count
  useEffect(() => {
    getPendingOperations().then(ops => setPendingCount(ops.length)).catch(() => {});
  }, []);

  return {
    isOffline,
    isSyncing,
    pendingCount,
    syncPendingOperations,
    cacheScansForOffline,
    getOfflineScans,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
