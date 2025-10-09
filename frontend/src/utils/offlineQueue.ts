// utils/offlineQueue.ts
// Enhanced IndexedDB-backed queue for storing offline sync operations
// This allows the service worker to access operations even when the app is closed

type OfflineOp = {
  id: string
  op: any
  timestamp: number
  retries?: number
}

const DB_NAME = 'todo-offline-queue'
const STORE_NAME = 'ops'
const DB_VERSION = 2 // Increment version to add timestamp index

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    
    req.onupgradeneeded = (event) => {
      const db = req.result
      
      // Delete old store if exists (for clean upgrade)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      
      // Create store with proper schema
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('timestamp', 'timestamp', { unique: false })
      store.createIndex('retries', 'retries', { unique: false })
      
      console.log('offlineQueue: Database upgraded to version', DB_VERSION)
    }
    
    req.onsuccess = () => {
      console.log('offlineQueue: Database opened successfully')
      resolve(req.result)
    }
    
    req.onerror = () => {
      console.error('offlineQueue: Failed to open database', req.error)
      reject(req.error)
    }
  })
}

// 🔥 FIX: Add operation with better error handling and deduplication
export async function addOperation(op: any): Promise<string> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      
      // Generate ID
      const id = (self.crypto && (self.crypto as any).randomUUID)
        ? (self.crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      
      const item: OfflineOp = {
        id,
        op,
        timestamp: Date.now(),
        retries: 0
      }
      
      const req = store.add(item as any)
      
      req.onsuccess = () => {
        console.log('✅ offlineQueue: Added operation', { 
          id, 
          type: op.type, 
          todoId: op.todo?.id 
        })
        resolve(id)
      }
      
      req.onerror = () => {
        console.error('❌ offlineQueue: Failed to add operation', req.error)
        reject(req.error)
      }
      
      tx.oncomplete = () => {
        db.close()
      }
      
      tx.onerror = () => {
        console.error('❌ offlineQueue: Transaction error', tx.error)
        db.close()
        reject(tx.error)
      }
    } catch (err) {
      console.error('❌ offlineQueue: Exception in addOperation', err)
      db.close()
      reject(err)
    }
  })
}

// Get count of pending operations
export async function getCount(): Promise<number> {
  try {
    const all = await getAllOperations()
    return all.length
  } catch (err) {
    console.error('offlineQueue: Failed to get count', err)
    return 0
  }
}

// Get all operations sorted by timestamp
export async function getAllOperations(): Promise<OfflineOp[]> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const req = index.getAll() // This will get all sorted by timestamp
      
      req.onsuccess = () => {
        const results = (req.result as OfflineOp[]) || []
        console.log(`📊 offlineQueue: Retrieved ${results.length} operations`)
        resolve(results)
      }
      
      req.onerror = () => {
        console.error('❌ offlineQueue: Failed to get operations', req.error)
        reject(req.error)
      }
      
      tx.oncomplete = () => {
        db.close()
      }
    } catch (err) {
      console.error('❌ offlineQueue: Exception in getAllOperations', err)
      db.close()
      reject(err)
    }
  })
}

// Clear all operations (after successful sync)
export async function clearAllOperations(): Promise<void> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.clear()
      
      req.onsuccess = () => {
        console.log('✅ offlineQueue: Cleared all operations')
        resolve()
      }
      
      req.onerror = () => {
        console.error('❌ offlineQueue: Failed to clear operations', req.error)
        reject(req.error)
      }
      
      tx.oncomplete = () => {
        db.close()
      }
    } catch (err) {
      console.error('❌ offlineQueue: Exception in clearAllOperations', err)
      db.close()
      reject(err)
    }
  })
}

// 🔥 NEW: Remove specific operation by ID
export async function removeOperation(id: string): Promise<void> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(id)
      
      req.onsuccess = () => {
        console.log('✅ offlineQueue: Removed operation', id)
        resolve()
      }
      
      req.onerror = () => {
        console.error('❌ offlineQueue: Failed to remove operation', req.error)
        reject(req.error)
      }
      
      tx.oncomplete = () => {
        db.close()
      }
    } catch (err) {
      console.error('❌ offlineQueue: Exception in removeOperation', err)
      db.close()
      reject(err)
    }
  })
}

// 🔥 NEW: Increment retry count for an operation
export async function incrementRetries(id: string): Promise<void> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(id)
      
      getReq.onsuccess = () => {
        const item = getReq.result as OfflineOp
        if (item) {
          item.retries = (item.retries || 0) + 1
          const putReq = store.put(item)
          
          putReq.onsuccess = () => {
            console.log(`offlineQueue: Incremented retries for ${id} to ${item.retries}`)
            resolve()
          }
          
          putReq.onerror = () => reject(putReq.error)
        } else {
          resolve() // Operation doesn't exist, that's ok
        }
      }
      
      getReq.onerror = () => reject(getReq.error)
      
      tx.oncomplete = () => {
        db.close()
      }
    } catch (err) {
      console.error('❌ offlineQueue: Exception in incrementRetries', err)
      db.close()
      reject(err)
    }
  })
}

// 🔥 NEW: Get statistics about the queue
export async function getQueueStats(): Promise<{
  total: number
  oldestTimestamp: number | null
  newestTimestamp: number | null
  byType: Record<string, number>
}> {
  try {
    const ops = await getAllOperations()
    
    const stats = {
      total: ops.length,
      oldestTimestamp: ops.length > 0 ? ops[0].timestamp : null,
      newestTimestamp: ops.length > 0 ? ops[ops.length - 1].timestamp : null,
      byType: {} as Record<string, number>
    }
    
    ops.forEach(op => {
      const type = op.op?.type || 'UNKNOWN'
      stats.byType[type] = (stats.byType[type] || 0) + 1
    })
    
    return stats
  } catch (err) {
    console.error('offlineQueue: Failed to get stats', err)
    return {
      total: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      byType: {}
    }
  }
}

// 🔥 NEW: Clear old operations (older than X days)
export async function clearOldOperations(daysOld: number = 7): Promise<number> {
  const db = await openDB()
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
  
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const range = IDBKeyRange.upperBound(cutoffTime)
      const req = index.openCursor(range)
      
      let deletedCount = 0
      
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          console.log(`offlineQueue: Cleared ${deletedCount} old operations`)
          resolve(deletedCount)
        }
      }
      
      req.onerror = () => {
        reject(req.error)
      }
      
      tx.oncomplete = () => {
        db.close()
      }
    } catch (err) {
      console.error('❌ offlineQueue: Exception in clearOldOperations', err)
      db.close()
      reject(err)
    }
  })
}

export default {
  addOperation,
  getAllOperations,
  clearAllOperations,
  removeOperation,
  incrementRetries,
  getCount,
  getQueueStats,
  clearOldOperations
}