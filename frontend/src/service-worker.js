// src/service-worker.js
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

console.log('🚀 SW: Loading service worker...')

// Safely handle the precache manifest
const manifest = self.__WB_MANIFEST || []
if (manifest.length > 0) {
  precacheAndRoute(manifest)
  console.log('✅ SW: Precached', manifest.length, 'files')
} else {
  console.log('⚠️ SW: No files to precache')
}

// Clean up old caches
cleanupOutdatedCaches()

// Store API URL globally
self.__API_URL = null

// Install event - activate immediately
self.addEventListener('install', (event) => {
  console.log('📦 SW: Install event')
  self.skipWaiting()
})

// Activate event - take control immediately
self.addEventListener('activate', (event) => {
  console.log('⚡ SW: Activate event')
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('✅ SW: Claimed all clients')
    })
  )
})

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
    ],
  })
)

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// Cache static resources
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// Listen for messages from the app
self.addEventListener('message', (event) => {
  console.log('📨 SW: Received message:', event.data)

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('⏭️ SW: Skip waiting requested')
    self.skipWaiting()
  }

  if (event.data?.type === 'SET_API_URL') {
    self.__API_URL = event.data.apiUrl
    console.log('🔧 SW: API URL set to', self.__API_URL)
  }

  if (event.data?.type === 'TRIGGER_SYNC') {
    console.log('🔄 SW: Manual sync triggered')
    performSync()
      .then(() => {
        console.log('✅ SW: Manual sync completed')
        event.ports[0]?.postMessage({ success: true })
      })
      .catch(err => {
        console.error('❌ SW: Manual sync failed', err)
        event.ports[0]?.postMessage({ success: false, error: err.message })
      })
  }
})

// 🔥 CRITICAL: Background Sync Event
self.addEventListener('sync', (event) => {
  console.log('🔔 SW: SYNC EVENT FIRED! Tag:', event.tag)
  console.log('🔔 SW: Event details:', {
    tag: event.tag,
    lastChance: event.lastChance,
    timestamp: new Date().toISOString()
  })

  if (event.tag === 'sync-todos') {
    console.log('🔄 SW: Starting background sync for todos...')
    event.waitUntil(
      performSync()
        .then(() => {
          console.log('✅ SW: Background sync completed successfully')
        })
        .catch(err => {
          console.error('❌ SW: Background sync failed:', err)
          // Re-throw to let browser retry
          throw err
        })
    )
  }
})

// Periodic background sync (Chrome only)
self.addEventListener('periodicsync', (event) => {
  console.log('⏰ SW: Periodic sync event:', event.tag)

  if (event.tag === 'sync-todos-periodic') {
    console.log('🔄 SW: Starting periodic background sync...')
    event.waitUntil(performSync())
  }
})

// 🔥 Main sync function
async function performSync() {
  const startTime = Date.now()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔄 SW: performSync() started at', new Date().toISOString())

  try {
    // Step 1: Open database
    console.log('📂 SW: Opening offline queue database...')
    const db = await openOfflineQueueDB()
    console.log('✅ SW: Database opened')

    // Step 2: Get all operations
    console.log('📊 SW: Fetching operations from queue...')
    const ops = await getAllOperations(db)
    console.log('📊 SW: Found', ops?.length || 0, 'operations')

    if (!ops || ops.length === 0) {
      console.log('ℹ️ SW: No operations to sync')
      await notifyClients({
        type: 'BACKGROUND_SYNC_COMPLETE',
        success: true,
        synced: 0
      })
      return
    }

    // Step 3: Prepare operations
    const operations = ops.map(o => {
      console.log('  📝 Operation:', o.op?.type, o.op?.payload?.id)
      return o.op
    })

    // Step 4: Get API URL
    const apiUrl = getApiUrl()
    console.log('🌐 SW: Syncing to:', apiUrl)

    // Step 5: Perform sync with retries
    let lastError = null
    let success = false

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 SW: Sync attempt ${attempt}/3...`)

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ operations })
        })

        console.log(`📡 SW: Response status: ${resp.status} ${resp.statusText}`)

        if (!resp.ok) {
          const text = await resp.text()
          console.error('❌ SW: Server error:', text)
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
        }

        const result = await resp.json()
        console.log(`✅ SW: Sync successful on attempt ${attempt}!`, result)

        // Step 6: Clear queue
        console.log('🗑️ SW: Clearing offline queue...')
        await clearOfflineQueue(db)
        console.log('✅ SW: Queue cleared')

        // Step 7: Notify clients
        await notifyClients({
          type: 'BACKGROUND_SYNC_COMPLETE',
          success: true,
          results: result,
          synced: ops.length
        })

        success = true
        break

      } catch (err) {
        lastError = err
        console.error(`❌ SW: Attempt ${attempt} failed:`, err.message)

        if (attempt < 3) {
          const delay = 1000 * Math.pow(2, attempt - 1)
          console.log(`⏳ SW: Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    if (!success) {
      console.error('❌ SW: All 3 sync attempts failed')
      await notifyClients({
        type: 'BACKGROUND_SYNC_COMPLETE',
        success: false,
        error: lastError?.message || 'Sync failed'
      })
      throw lastError || new Error('Sync failed after 3 attempts')
    }

    const duration = Date.now() - startTime
    console.log(`✅ SW: Sync completed in ${duration}ms`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`❌ SW: Background sync failed after ${duration}ms:`, err)
    console.error('Stack:', err.stack)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await notifyClients({
      type: 'BACKGROUND_SYNC_COMPLETE',
      success: false,
      error: err.message
    })

    throw err
  }
}

// Helper: Open IndexedDB
function openOfflineQueueDB() {
  return new Promise((resolve, reject) => {
    console.log('🔓 SW: Opening IndexedDB: todo-offline-queue')
    const req = indexedDB.open('todo-offline-queue', 2)

    req.onupgradeneeded = (event) => {
      console.log('🔧 SW: Upgrading database schema...')
      const db = event.target.result
      if (!db.objectStoreNames.contains('ops')) {
        db.createObjectStore('ops', { keyPath: 'id' })
        console.log('✅ SW: Created "ops" object store')
      }
    }

    req.onsuccess = () => {
      console.log('✅ SW: Database opened successfully')
      resolve(req.result)
    }

    req.onerror = () => {
      console.error('❌ SW: Database open failed:', req.error)
      reject(req.error)
    }
  })
}

// Helper: Get all operations
function getAllOperations(db) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('ops', 'readonly')
      const store = tx.objectStore('ops')
      const req = store.getAll()

      req.onsuccess = () => {
        const results = req.result || []
        console.log(`✅ SW: Retrieved ${results.length} operations`)
        resolve(results)
      }

      req.onerror = () => {
        console.error('❌ SW: Failed to get operations:', req.error)
        reject(req.error)
      }
    } catch (err) {
      console.error('❌ SW: Transaction error:', err)
      reject(err)
    }
  })
}

// Helper: Clear offline queue
function clearOfflineQueue(db) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('ops', 'readwrite')
      const store = tx.objectStore('ops')
      const req = store.clear()

      req.onsuccess = () => {
        console.log('✅ SW: Queue cleared')
        resolve()
      }

      req.onerror = () => {
        console.error('❌ SW: Failed to clear queue:', req.error)
        reject(req.error)
      }
    } catch (err) {
      console.error('❌ SW: Clear transaction error:', err)
      reject(err)
    }
  })
}

// Helper: Get API URL
function getApiUrl() {
  if (self.__API_URL) {
    const url = new URL('/api/sync', self.__API_URL).toString()
    console.log('🔧 SW: Using stored API URL:', url)
    return url
  }

  if (self.location?.origin) {
    const url = new URL('/api/sync', self.location.origin).toString()
    console.log('🔧 SW: Using location origin:', url)
    return url
  }

  console.log('🔧 SW: Using relative URL: /api/sync')
  return '/api/sync'
}

// Helper: Notify all clients
async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window'
    })

    console.log(`📢 SW: Notifying ${clients.length} client(s)`, message)

    clients.forEach(client => {
      client.postMessage(message)
    })
  } catch (err) {
    console.error('❌ SW: Failed to notify clients:', err)
  }
}

console.log('✅ SW: Service worker loaded and ready')
console.log('🔍 SW: Background Sync supported:', 'sync' in self.registration)
console.log('🔍 SW: Periodic Sync supported:', 'periodicSync' in self.registration)