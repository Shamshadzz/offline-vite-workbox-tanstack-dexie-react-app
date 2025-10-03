/**
 * Storage Manager for IndexedDB monitoring and management
 */

export interface StorageInfo {
  usage: number
  quota: number
  percentage: number
  available: number
}

/**
 * Get current storage usage and quota
 */
export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    console.warn('Storage API not supported')
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    const percentage = quota > 0 ? (usage / quota) * 100 : 0
    const available = quota - usage

    return {
      usage,
      quota,
      percentage,
      available
    }
  } catch (error) {
    console.error('Failed to get storage info:', error)
    return null
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Check if storage is persistent
 */
export async function isStoragePersistent(): Promise<boolean> {
  if (!('storage' in navigator) || !('persisted' in navigator.storage)) {
    return false
  }

  try {
    return await navigator.storage.persisted()
  } catch (error) {
    console.error('Failed to check storage persistence:', error)
    return false
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    console.warn('Persistent storage not supported')
    return false
  }

  try {
    const isPersisted = await navigator.storage.persist()
    console.log(isPersisted ? '✅ Storage is persistent' : '⚠️ Storage is not persistent')
    return isPersisted
  } catch (error) {
    console.error('Failed to request persistent storage:', error)
    return false
  }
}

/**
 * Clear all application data (with confirmation)
 */
export async function clearAllData(): Promise<boolean> {
  const confirmed = window.confirm(
    'Are you sure you want to clear all local data? This cannot be undone.'
  )

  if (!confirmed) return false

  try {
    // Clear IndexedDB
    const databases = await window.indexedDB.databases()
    for (const db of databases) {
      if (db.name) {
        window.indexedDB.deleteDatabase(db.name)
      }
    }

    // Clear localStorage (if needed for other data)
    // Note: Don't use for artifacts as mentioned in instructions
    // localStorage.clear()

    console.log('✅ All data cleared')
    return true
  } catch (error) {
    console.error('❌ Failed to clear data:', error)
    return false
  }
}

/**
 * Export data as JSON
 */
export function exportData<T>(data: T, filename: string = 'export.json'): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  
  URL.revokeObjectURL(url)
}

/**
 * Import data from JSON file
 */
export function importData<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        resolve(data)
      } catch (error) {
        reject(new Error('Invalid JSON file'))
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Monitor storage usage
 */
export class StorageMonitor {
  private interval: number | null = null;
  private callbacks: Array<(info: StorageInfo) => void> = []

  start(intervalMs: number = 30000) {
    if (this.interval) return

    this.interval = setInterval(async () => {
      const info = await getStorageInfo()
      if (info) {
        this.callbacks.forEach(cb => cb(info))
        
        // Warn if storage is getting full
        if (info.percentage > 80) {
          console.warn(`⚠️ Storage is ${info.percentage.toFixed(1)}% full`)
        }
      }
    }, intervalMs)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  onChange(callback: (info: StorageInfo) => void) {
    this.callbacks.push(callback)
    
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback)
    }
  }
}

/**
 * Database backup utilities
 */
export async function createBackup(dbName: string): Promise<Blob | null> {
  try {
    // This is a simplified version - in production, you'd want to use
    // a proper IndexedDB export library
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    // Export all object stores
    const backup: any = {}
    const stores = Array.from(db.objectStoreNames)

    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const data = await new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      backup[storeName] = data
    }

    db.close()

    const json = JSON.stringify(backup, null, 2)
    return new Blob([json], { type: 'application/json' })
  } catch (error) {
    console.error('Backup failed:', error)
    return null
  }
}