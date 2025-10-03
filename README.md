# Offline-First Todo App

A production-ready, offline-first todo application built with React, TanStack Query, Dexie (IndexedDB), and Workbox for service worker management.

## Features

- **Offline-First Architecture**: Works seamlessly offline with automatic sync when online
- **IndexedDB Persistence**: Data stored locally using Dexie
- **Conflict Resolution**: Smart merging of local and server changes
- **Background Sync**: Automatic sync when connection is restored
- **Progressive Web App**: Installable on mobile and desktop
- **Real-time Updates**: Live queries with TanStack React DB
- **Optimistic Updates**: Instant UI feedback
- **Batch Operations**: Efficient syncing of multiple changes
- **Storage Management**: Monitor and manage local storage usage

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **TanStack React Query** - Data fetching and caching
- **TanStack React DB** - Live query layer
- **Dexie** - IndexedDB wrapper
- **tanstack-dexie-db-collection** - Bridge between TanStack DB and Dexie
- **Workbox** - Service worker management
- **Tailwind CSS** - Styling
- **Vite** - Build tool

## Project Structure

```
src/
├── collections/
│   └── db.ts                    # Dexie collection configuration
├── components/
│   ├── TodoInput.tsx            # Todo input component
│   ├── TodoList.tsx             # Todo list component
│   ├── SettingsPanel.tsx        # Settings and debug panel
│   └── SyncIndicator.tsx        # Sync status indicator
├── hooks/
│   ├── useSync.tsx              # Sync logic hook
│   └── useNetworkStatus.ts      # Network detection
├── pages/
│   └── TodoPage.tsx             # Main todo page
├── services/
│   └── api.ts                   # API client
├── types/
│   └── types.ts                 # TypeScript definitions
├── utils/
│   ├── storageManager.ts        # Storage utilities
│   ├── retryUtils.ts            # Retry and queue logic
│   ├── conflictResolver.ts      # Conflict resolution
│   └── serviceWorkerRegistration.ts  # SW helpers
├── config/
│   └── queryClient.ts           # React Query config
├── App.tsx                      # Root component
└── main.tsx                     # Entry point
```

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

### API Endpoint

Update the API URL in `src/collections/db.ts` and `src/services/api.ts`:

```typescript
const API_URL = "https://your-api-endpoint.com/api";
```

### Service Worker

The service worker is configured in `vite.config.ts` using the `vite-plugin-pwa` plugin. Adjust caching strategies as needed.

## Key Implementation Details

### 1. Collection Setup (db.ts)

The app uses `tanstack-dexie-db-collection` to bridge TanStack DB with Dexie:

```typescript
export const todoCollection = createCollection({
  ...dexieCollectionOptions({
    id: "todos",
    schema: todoSchema,
    getKey: (todo) => todo.id,
    dbName: "tanstack-todo-db",
    tableName: "todos",
    rowUpdateMode: "full",
    syncBatchSize: 100,
  }),
});
```

### 2. Sync Strategy (useSync.tsx)

- **Debounced Sync**: Batches rapid changes to reduce API calls
- **Conflict Resolution**: Last-write-wins with version tracking
- **Auto-Sync**: Syncs every 30 seconds when online
- **Reconnection Handling**: Full sync when coming back online
- **Error Retry**: Exponential backoff for failed syncs

### 3. Offline Support

- Service worker caches all assets and API responses
- IndexedDB stores all todos locally
- Changes are queued and synced when online
- Background sync API for automatic sync after reconnection

### 4. Storage Management

- Monitor storage quota and usage
- Request persistent storage to prevent eviction
- Export/import data
- Clear all data option

## API Requirements

Your backend should implement these endpoints:

### GET /api/todos

Returns all todos for the user.

### POST /api/sync

Batch sync endpoint accepting operations:

```json
{
  "operations": [
    {
      "type": "CREATE" | "UPDATE" | "DELETE",
      "todo": { /* todo object */ }
    }
  ]
}
```

### GET /api/health

Health check endpoint.

## Development

### Enable Service Worker in Dev Mode

The service worker is enabled in development for testing. To disable:

```typescript
// vite.config.ts
devOptions: {
  enabled: false; // Change to false
}
```

### Debug Tools

- Press `Ctrl+K` to open settings panel
- View sync status, storage usage, and statistics
- Force manual sync
- Export/backup data
- React Query DevTools available in development

## Production Deployment

1. Build the app: `npm run build`
2. Deploy the `dist` folder to your hosting service
3. Ensure your server serves `index.html` for all routes
4. Configure HTTPS (required for service workers)
5. Set up CORS if API is on different domain

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with service worker support

## Performance Considerations

- Batch sync operations to reduce network requests
- Use debouncing for rapid user actions
- Implement optimistic updates for instant feedback
- Clean up deleted items after successful sync
- Monitor IndexedDB size and implement cleanup strategies

## Troubleshooting

### Sync Not Working

1. Check network connection
2. Verify API endpoint is accessible
3. Check browser console for errors
4. Open Settings panel to view sync status

### Storage Quota Exceeded

1. Open Settings panel
2. Check storage usage
3. Clear completed todos
4. Request persistent storage

### Service Worker Issues

1. Unregister old service workers in DevTools
2. Clear site data and reload
3. Check service worker registration in console

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
