// App.tsx
import React, { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./config/queryClient";
import { TodoPage } from "./features/TodoPage";
import { SettingsPanel } from "./components/SettingsPanel";
import { useSync } from "./hooks/useSync";
import { 
  requestBackgroundSync, 
  listenForSWMessages, 
  sendMessageToSW,
  isBackgroundSyncSupported,
  triggerManualSync
} from "./utils/serviceWorkerRegistration";
import { todoCollection } from "./collections/db";
import { requestPersistentStorage } from "./utils/storageManager";
import { Settings } from "lucide-react";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [bgSyncSupported, setBgSyncSupported] = useState(false);

  const { fullSync, fetchFromServer } = useSync();

  // Request persistent storage and keyboard shortcuts
  useEffect(() => {
    requestPersistentStorage();

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 🔥 Setup SW message listener and send API URL
  useEffect(() => {
    // Check background sync support
    setBgSyncSupported(isBackgroundSyncSupported());
    
    // Wait for SW to be ready, then send API URL
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        const apiUrl = import.meta.env.VITE_API_URL
        if (apiUrl) {
          setTimeout(() => {
            sendMessageToSW({ type: 'SET_API_URL', apiUrl })
            console.log('📤 API URL sent to SW:', apiUrl)
          }, 500)
        }
      })
    }

    // Listen for SW messages
    listenForSWMessages((data) => {
      if (!data) return
      
      console.log('📨 Received message from SW:', data)
      
      if (data.type === 'BACKGROUND_SYNC_COMPLETE') {
        if (data.success) {
          console.log(`✅ Background sync completed: ${data.synced || 0} items synced`)
          
          // Fetch latest from server to update UI
          fetchFromServer(true).then(() => {
            console.log('✅ UI refreshed after background sync')
          })
        } else {
          console.error('❌ Background sync failed:', data.error)
        }
      }
    })
  }, [fetchFromServer])

  // 🔥 Enhanced offline queue monitoring and background sync registration
  useEffect(() => {
    let monitorTimer: number | undefined
    let lastUnsyncedCount = 0

    const checkAndRegisterSync = async () => {
      try {
        const table = todoCollection.utils.getTable()
        const all = await table.toArray()
        const unsyncedTodos = all.filter((t: any) => !t.synced)
        const currentCount = unsyncedTodos.length
        
        // Only register sync if there's new unsynced data
        if (currentCount > 0 && currentCount !== lastUnsyncedCount) {
          console.log(`📊 Found ${currentCount} unsynced todos, registering background sync...`)
          
          const registered = await requestBackgroundSync('sync-todos')
          
          if (registered) {
            console.log('✅ Background sync registered successfully')
            lastUnsyncedCount = currentCount
          } else {
            console.warn('⚠️ Background sync registration failed')
          }
        } else if (currentCount === 0 && lastUnsyncedCount > 0) {
          console.log('✅ All todos synced')
          lastUnsyncedCount = 0
        }
      } catch (err) {
        console.error('❌ Error checking unsynced todos:', err)
      }
    }

    // Start monitoring
    const startMonitoring = () => {
      checkAndRegisterSync() // Check immediately
      monitorTimer = window.setInterval(checkAndRegisterSync, 5000) // Check every 5 seconds
    }

    // Handle online/offline
    const handleOnline = async () => {
      console.log('🟢 Back online!')
      await checkAndRegisterSync()
      
      // Also trigger immediate sync if online
      if (navigator.onLine) {
        setTimeout(() => fullSync(false), 1000)
      }
    }

    const handleOffline = () => {
      console.log('🔴 Gone offline')
      checkAndRegisterSync()
    }

    // Register sync before page unload
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      try {
        const table = todoCollection.utils.getTable()
        const all = await table.toArray()
        const hasUnsynced = all.some((t: any) => !t.synced)
        
        if (hasUnsynced) {
          console.log('📱 Registering background sync before unload...')
          await requestBackgroundSync('sync-todos')
          
          e.preventDefault()
          e.returnValue = ''
        }
      } catch (err) {
        console.error('❌ Error on beforeunload:', err)
      }
    }

    // Register sync when page visibility changes
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        console.log('👁️ Page going to background, registering sync...')
        await checkAndRegisterSync()
      } else if (document.visibilityState === 'visible') {
        console.log('👁️ Page visible again, checking for updates...')
        fetchFromServer(false)
      }
    }

    startMonitoring()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (monitorTimer) clearInterval(monitorTimer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchFromServer, fullSync])

  // Initial sync on mount
  useEffect(() => {
    if (navigator.onLine) {
      setTimeout(() => {
        console.log('🔄 Initial sync on app mount')
        fullSync(true)
      }, 1000)
    }
  }, [])

  // Manual sync trigger for testing
  const handleManualSync = async () => {
    console.log('🔄 Manual sync triggered')
    const success = await triggerManualSync()
    if (success) {
      setTimeout(() => fetchFromServer(true), 1000)
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Background Sync Status Banner */}
        {!bgSyncSupported && (
          <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 text-sm">
            ⚠️ Background Sync not supported
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="fixed top-4 right-4 z-40 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          title="Settings (Ctrl+K)"
        >
          <Settings />
        </button>

        {/* Manual Sync Button (dev only) */}
        {import.meta.env.DEV && (
          <button
            onClick={handleManualSync}
            className="fixed top-4 right-20 z-40 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium"
            title="Trigger Manual Sync"
          >
            🔄 Sync Now
          </button>
        )}

        {/* Main Content */}
        <div className="pt-20 pb-8">
          <TodoPage />
        </div>

        {/* Settings Panel */}
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />

        <ReactQueryDevtools initialIsOpen={false} />
      </div>
    </QueryClientProvider>
  );
}

export default App;