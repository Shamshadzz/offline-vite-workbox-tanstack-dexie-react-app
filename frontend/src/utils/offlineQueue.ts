// utils/offlineQueue.ts
// Small IndexedDB-backed queue for storing offline sync operations so the
// service worker can access them while the app is closed.

type OfflineOp = {
  id: string;
  op: any;
};

const DB_NAME = 'todo-offline-queue';
const STORE_NAME = 'ops';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addOperation(op: any): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const id = (self.crypto && (self.crypto as any).randomUUID)
      ? (self.crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: OfflineOp = { id, op };
    const req = store.add(item as any);
    req.onsuccess = () => {
      tx.oncomplete = () => {
        db.close();
        resolve(id);
      };
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getAllOperations(): Promise<OfflineOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result as OfflineOp[]);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function clearAllOperations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export default {
  addOperation,
  getAllOperations,
  clearAllOperations,
};
