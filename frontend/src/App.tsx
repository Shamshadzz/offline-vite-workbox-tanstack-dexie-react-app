// App.tsx
import React, { KeyboardEvent, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./config/queryClient";
import { TodoPage } from "./features/TodoPage";
import { SettingsPanel } from "./components/SettingsPanel";
// import {
//   register,
//   listenForSWMessages,
// } from "./utils/serviceWorkerRegistration";
import { useSync} from "./hooks/useSync";
import { register, requestBackgroundSync, listenForSWMessages } from "./utils/serviceWorkerRegistration";
import { todoCollection } from "./collections/db";
import { requestPersistentStorage } from "./utils/storageManager";
import { Settings } from "lucide-react";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const { fullSync, fetchFromServer } = useSync();

  useEffect(() => {
    // Request persistent storage
    requestPersistentStorage();

    // Handle keyboard shortcuts
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Optionally: remove SW message listener if listenForSWMessages supports it
    };
  }, []);

  // Register service worker and listen for messages
  useEffect(() => {
    try {
      register({
        onSuccess: (registration) => {
          setSwRegistration(registration)
        },
        onUpdate: (registration) => {
          setSwRegistration(registration)
          setUpdateAvailable(true)
        }
      })

      // Listen for messages from the service worker
      listenForSWMessages((data) => {
        try {
          if (!data) return
          // SW asked the app to run a background sync (e.g. SW sync event)
          if (data.type === 'BACKGROUND_SYNC') {
            console.log('Received BACKGROUND_SYNC message from SW', data)
            // SW already attempted to push operations to the server.
            // Fetch canonical state so local DB reflects server's result.
            fetchFromServer(true)
          }
        } catch (err) {
          console.error('Error handling SW message', err)
        }
      })
    } catch (err) {
      console.warn('Service worker registration/listener skipped:', err)
    }
    // We intentionally do not include `fullSync` in deps to avoid repeated
    // registrations of the SW listener; listenForSWMessages registers a
    // global listener which is safe to call once at app startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When offline and there are unsynced todos, ask the service worker to
  // register a background sync so the SW can attempt to sync when the
  // connection is restored (or the browser decides to run the sync).
  useEffect(() => {
    let pollTimer: number | undefined

    const startPolling = () => {
      if (!(window && 'serviceWorker' in navigator)) return

      // Poll every 5 seconds while offline to detect unsynced items and
      // request a background-sync registration (one-shot)
      pollTimer = window.setInterval(async () => {
        try {
          if (navigator.onLine) return
          const table = todoCollection.utils.getTable()
          const all = await table.toArray()
          const hasUnsynced = all.some((t: any) => !t.synced)
          if (hasUnsynced) {
            try {
              await requestBackgroundSync('sync-todos')
              console.log('Requested background sync (sync-todos)')
            } catch (err) {
              console.warn('Background sync request failed', err)
            }
            // We only need to register once for the current offline session
            if (pollTimer) {
              clearInterval(pollTimer)
              pollTimer = undefined
            }
          }
        } catch (err) {
          console.error('Error while checking unsynced todos for SW sync', err)
        }
      }, 5000)
    }

    // Start polling only when offline
    if (!navigator.onLine) startPolling()

    const handleOffline = () => startPolling()
    const handleOnline = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = undefined
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Also try to register a background sync when the page is being closed
    // so the SW has a chance to run the sync after the page unloads.
    const handleBeforeUnload = async () => {
      try {
        const table = todoCollection.utils.getTable()
        const all = await table.toArray()
        const hasUnsynced = all.some((t: any) => !t.synced)
        if (hasUnsynced) {
          try {
            await requestBackgroundSync('sync-todos')
            console.log('Requested background sync on beforeunload')
          } catch (err) {
            console.warn('Background sync registration failed on unload', err)
          }
        }
      } catch (err) {
        /* swallow */
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (pollTimer) clearInterval(pollTimer)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    // Intentionally not listing todoCollection in deps; it's a stable import.
  }, [])

  // Initialize sync once on mount. `useSync` already registers online/offline
  // handlers and will trigger syncs when the connection is restored or when
  // the app queues changes. Calling `fullSync` repeatedly (by including it
  // in the dependency array) can trigger extra syncs because the callback
  // identity may change as internal state updates. Call once at mount when
  // online to bootstrap state.
  useEffect(() => {
    if (navigator.onLine) {
      // intentionally not including `fullSync` in deps to avoid repeated runs
      // eslint-disable-next-line react-hooks/exhaustive-deps
      // Force server-state on initial load to ensure Dexie reflects backend
      fullSync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleUpdateApp = () => {
    if (swRegistration && swRegistration.waiting) {
      // Tell the service worker to skip waiting
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });

      // Reload the page
      window.location.reload();
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Update Banner */}
        {updateAvailable && (
          <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 z-50 flex items-center justify-between shadow-lg">
            <span className="font-medium">A new version is available!</span>
            <button
              onClick={handleUpdateApp}
              className="btn btn-primary px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors shadow-sm"
            >
              Update Now
            </button>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="btn-icon fixed top-4 right-4 z-40 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          title="Settings (Ctrl+K)"
        >
          <Settings />
        </button>

        {/* Main Content */}
        <div className="pt-20 pb-8">
          <TodoPage />
        </div>

        {/* Settings Panel */}
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />

        {/* React Query Devtools (only in development) */}
        <ReactQueryDevtools initialIsOpen={false} />
      </div>
    </QueryClientProvider>
  );
}

export default App;
