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
    .then((registration) => {
      console.log('Service Worker registered:', registration)

      // Check for updates periodically
      setInterval(() => {
        registration.update()
      }, 60000) // Check every minute

      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New update available
              console.log('New content available; please refresh.')

              if (config && config.onUpdate) {
                config.onUpdate(registration)
              }
            } else {
              // Content cached for offline use
              console.log('Content cached for offline use.')

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
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error)
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

// Request background sync
export async function requestBackgroundSync(tag: string) {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // Type assertion to access sync
      const swReg = registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };

      if (swReg.sync) {
        await swReg.sync.register(tag);
        console.log('Background sync registered:', tag);
      }
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
}

// Listen for messages from service worker
export function listenForSWMessages(
  callback: (data: any) => void
) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      callback(event.data)
    })
  }
}

// Send message to service worker
export function sendMessageToSW(message: any) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message)
  }
}