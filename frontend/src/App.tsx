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
import { requestPersistentStorage } from "./utils/storageManager";
import { Settings } from "lucide-react";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const { fullSync } = useSync();

  useEffect(() => {
    // Register service worker
    // register({
    //   onSuccess: () => {
    //     console.log("App is ready for offline use");
    //   },
    //   onUpdate: (registration: ServiceWorkerRegistration) => {
    //     console.log("New version available!");
    //     setUpdateAvailable(true);
    //     setSwRegistration(registration);
    //   },
    //   onOfflineReady: () => {
    //     console.log("App is ready to work offline");
    //   },
    // });

    // Listen for SW messages
    const swMessageHandler = (data: any) => {
      if (data?.type === "BACKGROUND_SYNC") {
        console.log("Background sync triggered by SW");
        window.dispatchEvent(new CustomEvent("force-sync"));
      }
    };
    // listenForSWMessages(swMessageHandler);

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

  // Initialize sync hook to register online/offline handlers and auto-sync
  // This hook sets up background sync, periodic syncs and listens for force-sync events.
  useEffect(() => {
    fullSync();
  }, [fullSync]);


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
