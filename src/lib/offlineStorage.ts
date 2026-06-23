// IndexedDB-based offline storage for translations and scans

const DB_NAME = 'wanderlens-offline';
const DB_VERSION = 1;

interface CachedTranslation {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

interface CachedScan {
  id: string;
  category: string;
  name: string | null;
  description: string | null;
  location_name: string | null;
  image_url: string | null;
  image_data: string | null; // Base64 image data for offline access
  extracted_text: string | null;
  ai_analysis: Record<string, unknown> | null;
  is_favorite: boolean;
  created_at: string;
  synced: boolean;
}

let db: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create translations store
      if (!database.objectStoreNames.contains('translations')) {
        const translationsStore = database.createObjectStore('translations', { keyPath: 'id' });
        translationsStore.createIndex('sourceText_targetLang', ['sourceText', 'targetLang'], { unique: true });
        translationsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create scans store
      if (!database.objectStoreNames.contains('scans')) {
        const scansStore = database.createObjectStore('scans', { keyPath: 'id' });
        scansStore.createIndex('synced', 'synced', { unique: false });
        scansStore.createIndex('is_favorite', 'is_favorite', { unique: false });
        scansStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Create pending operations store for sync
      if (!database.objectStoreNames.contains('pending_operations')) {
        database.createObjectStore('pending_operations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Translation caching functions
export async function cacheTranslation(
  sourceText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string
): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['translations'], 'readwrite');
  const store = transaction.objectStore('translations');

  const id = `${sourceLang}_${targetLang}_${hashString(sourceText)}`;
  
  const cached: CachedTranslation = {
    id,
    sourceText,
    translatedText,
    sourceLang,
    targetLang,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(cached);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedTranslation(
  sourceText: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['translations'], 'readonly');
  const store = transaction.objectStore('translations');

  const id = `${sourceLang}_${targetLang}_${hashString(sourceText)}`;

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as CachedTranslation | undefined;
      resolve(result?.translatedText || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Scan caching functions
export async function cacheScan(scan: Omit<CachedScan, 'synced'>): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['scans'], 'readwrite');
  const store = transaction.objectStore('scans');

  const cached: CachedScan = {
    ...scan,
    synced: true,
  };

  return new Promise((resolve, reject) => {
    const request = store.put(cached);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedScans(): Promise<CachedScan[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['scans'], 'readonly');
  const store = transaction.objectStore('scans');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedScan(id: string): Promise<CachedScan | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['scans'], 'readonly');
  const store = transaction.objectStore('scans');

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function updateCachedScanFavorite(id: string, is_favorite: boolean): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['scans'], 'readwrite');
  const store = transaction.objectStore('scans');

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const scan = getRequest.result as CachedScan | undefined;
      if (scan) {
        scan.is_favorite = is_favorite;
        const putRequest = store.put(scan);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteCachedScan(id: string): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['scans'], 'readwrite');
  const store = transaction.objectStore('scans');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Pending operations for offline-first sync
export async function addPendingOperation(operation: {
  type: 'create' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['pending_operations'], 'readwrite');
  const store = transaction.objectStore('pending_operations');

  return new Promise((resolve, reject) => {
    const request = store.add({ ...operation, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingOperations(): Promise<Array<{
  id: number;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  timestamp: number;
}>> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['pending_operations'], 'readonly');
  const store = transaction.objectStore('pending_operations');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearPendingOperation(id: number): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['pending_operations'], 'readwrite');
  const store = transaction.objectStore('pending_operations');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Clear old translations (keep last 500)
export async function cleanupOldTranslations(): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(['translations'], 'readwrite');
  const store = transaction.objectStore('translations');
  const index = store.index('timestamp');

  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, 'next');
    const toDelete: string[] = [];
    let count = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        count++;
        if (count > 500) {
          // Keep only the newest 500
        } else {
          toDelete.push(cursor.value.id);
        }
        cursor.continue();
      } else {
        // Delete old entries
        const deletePromises = toDelete.slice(0, -500).map(id => {
          return new Promise<void>((res, rej) => {
            const delReq = store.delete(id);
            delReq.onsuccess = () => res();
            delReq.onerror = () => rej(delReq.error);
          });
        });
        Promise.all(deletePromises).then(() => resolve()).catch(reject);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Simple string hash for cache keys
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
