/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_URL: string;

  // App Configuration
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;

  // Database Configuration
  readonly VITE_DB_NAME: string;
  readonly VITE_DB_VERSION: string;

  // Sync Configuration
  readonly VITE_SYNC_INTERVAL: string;       // number as string from .env
  readonly VITE_SYNC_BATCH_SIZE: string;     // number as string from .env
  readonly VITE_RETRY_MAX_ATTEMPTS: string;  // number as string from .env
  readonly VITE_RETRY_INITIAL_DELAY: string; // number as string from .env

  // Feature Flags
  readonly VITE_ENABLE_SERVICE_WORKER: string; // boolean as string from .env
  readonly VITE_ENABLE_BACKGROUND_SYNC: string; // boolean as string from .env
  readonly VITE_ENABLE_PERSISTENT_STORAGE: string; // boolean as string from .env

  // Development
  readonly VITE_ENABLE_DEVTOOLS: string; // boolean as string from .env
  readonly VITE_LOG_LEVEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
