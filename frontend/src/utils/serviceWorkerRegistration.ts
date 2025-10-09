// utils/serviceWorkerRegistration.ts

interface Config {
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onOfflineReady?: () => void
}

export function register(config?: Config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL}service-worker.js`
      registerValidSW(swUrl, config)
    })
  }
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(async (registration) => {
      console.log('✅ Service Worker registered:', registration)

      // If there's already a waiting worker, ask it to skip waiting so it can activate
      try {
        if (registration.waiting) {
          try {
            console.log('� Found waiting SW — sending SKIP_WAITING')
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          } catch (err) {
            console.warn('Could not message waiting SW:', err)
          }
        }
      } catch (err) {
        console.warn('Error checking registration.waiting:', err)
      }

      // �🔥 FIX: Send API URL immediately after registration
      const apiUrl = import.meta.env.VITE_API_URL
      if (apiUrl) {
        // Wait a bit for SW to be ready
        await new Promise(resolve => setTimeout(resolve, 100))
        sendMessageToSW({ type: 'SET_API_URL', apiUrl })
        console.log('📤 Sent API URL to SW:', apiUrl)
      }

      // 🔥 NEW: Register periodic background sync (if supported)
      try {
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync' as any
        })
        
        if (status.state === 'granted') {
          // @ts-ignore - periodic sync is not in all types yet
          await registration.periodicSync?.register('sync-todos-periodic', {
            minInterval: 60 * 1000 // 1 minute (browsers will honor this as minimum)
          })
          console.log('✅ Periodic background sync registered')
        }
      } catch (err) {
        console.log('ℹ️ Periodic background sync not supported:', err)
      }

      // Check for updates periodically
      setInterval(() => {
        registration.update()
      }, 60000) // Check every minute

      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }
        console.log('SW: updatefound, installingWorker state=', installingWorker.state)
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('🔄 New content available; please refresh.')

              if (config && config.onUpdate) {
                config.onUpdate(registration)
              }
            } else {
              console.log('✅ Content cached for offline use.')

              if (config && config.onOfflineReady) {
                config.onOfflineReady()
              }

              if (config && config.onSuccess) {
                config.onSuccess(registration)
              }
            }
          }
        }
      }

      // Reload the page when a new service worker takes control to ensure navigator.serviceWorker.controller is set
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        console.log('🔁 Service worker controller changed — reloading page')
        try {
          window.location.reload()
        } catch (err) {
          console.warn('Could not reload page after controllerchange:', err)
        }
      })
    })
    .catch((error) => {
      console.error('❌ Error during service worker registration:', error)
    })
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => {
        console.error(error.message)
      })
  }
}

// 🔥 FIX: Request background sync with better error handling
export async function requestBackgroundSync(tag: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    
    // Check if sync is supported
    if (!('sync' in registration)) {
      console.warn('Background Sync not supported')
      return false
    }

    // Type assertion to access sync
    const swReg = registration as ServiceWorkerRegistration & {
      sync: { register: (tag: string) => Promise<void> }
    }

    await swReg.sync.register(tag)
    console.log('✅ Background sync registered:', tag)
    return true
    
  } catch (error) {
    console.error('❌ Background sync registration failed:', error)
    return false
  }
}

// 🔥 NEW: Trigger manual sync (for testing or immediate sync)
export async function triggerManualSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    console.warn('Service Worker not ready')
    return false
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel()
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data?.success) {
        console.log('✅ Manual sync completed')
        resolve(true)
      } else {
        console.error('❌ Manual sync failed:', event.data?.error)
        resolve(false)
      }
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(
        { type: 'TRIGGER_SYNC' },
        [messageChannel.port2]
      )
    } else {
      console.warn('⚠️ Service Worker controller not available')
      resolve(false)
    }
  })
}

// Listen for messages from service worker
export function listenForSWMessages(callback: (data: any) => void) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('📨 Message from SW:', event.data)
      callback(event.data)
    })
  }
}

// Send message to service worker
export function sendMessageToSW(message: any) {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Worker not supported')
    return
  }

  // If the page is already controlled, use the controller
  if (navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage(message)
      console.log('📤 Message sent to SW (controller):', message)
      return
    } catch (err) {
      console.warn('⚠️ Failed to postMessage to controller:', err)
    }
  }

  // Fallback: try to get the active service worker from the registration
  ;(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const sw = registration.active || registration.waiting || registration.installing
      if (sw) {
        try {
          // @ts-ignore - ServiceWorker has postMessage
          sw.postMessage(message)
          console.log('📤 Message sent to SW (registration.active):', message)
          return
        } catch (err) {
          console.warn('⚠️ Failed to postMessage to registration worker:', err)
        }
      }

      console.warn('⚠️ No active service worker to receive message')
    } catch (err) {
      console.error('❌ Error while sending message to SW:', err)
    }
  })()
}

// 🔥 NEW: Check if background sync is supported
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window
}

// 🔥 NEW: Check if periodic background sync is supported
export async function isPeriodicSyncSupported(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  
  try {
    const registration = await navigator.serviceWorker.ready
    return 'periodicSync' in registration
  } catch {
    return false
  }
}