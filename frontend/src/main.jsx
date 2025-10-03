import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("New content available. Reload?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log app initialization
console.log("Todo App initialized");
console.log("Environment:", import.meta.env.MODE);

// Check for browser support
if (!("indexedDB" in window)) {
  console.error("This browser does not support IndexedDB");
  alert(
    "Your browser does not support local storage. Some features may not work."
  );
}

if (!("serviceWorker" in navigator)) {
  console.warn("Service workers are not supported");
}

// Log storage estimate on load
if ("storage" in navigator && "estimate" in navigator.storage) {
  navigator.storage.estimate().then((estimate) => {
    const percentUsed =
      estimate.usage && estimate.quota
        ? ((estimate.usage / estimate.quota) * 100).toFixed(2)
        : 0;
    console.log(
      `Storage: ${estimate.usage} / ${estimate.quota} bytes (${percentUsed}%)`
    );
  });
}
