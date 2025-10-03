import { useEffect, useCallback, useState, useRef } from 'react'
import { todoCollection } from '../collections/db'
import { syncTodos, fetchTodos, checkHealth } from '../services/api'
import { Todo as TodoType } from '../types/types'
import { debounce } from '../utils/retryUtils'

export const useSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncQueueRef = useRef<Set<string>>(new Set())

  // Debounced sync to batch rapid changes
  const debouncedSync = useCallback(
    debounce(() => {
      syncToServer()
    }, 2000),
    []
  )

  // Sync unsynced todos to server
  const syncToServer = useCallback(async () => {
    if (!navigator.onLine || isSyncing) {
      return
    }

    setIsSyncing(true)
    setSyncError(null)

    try {
      // Get all unsynced todos from collection
      const table = todoCollection.utils.getTable(); // raw Dexie table
      const allTodos = (await table.toArray()) as unknown as TodoType[];
      const unsyncedTodos = allTodos.filter(t => !t.synced);


      if (unsyncedTodos.length === 0) {
        setIsSyncing(false)
        return
      }

      console.log(`Syncing ${unsyncedTodos.length} todos to server...`)

      // Prepare operations
      const operations = unsyncedTodos.map((todo: TodoType) => ({
        type: todo.deleted ? 'DELETE' : todo.version === 1 ? 'CREATE' : 'UPDATE',
        todo: {
          ...todo,
          createdAt: todo.createdAt?.toISOString(),
          updatedAt: todo.updatedAt?.toISOString()
        }
      }))

      // Sync to server
      const result = await syncTodos(operations)

      // Mark todos as synced or remove deleted ones
      for (const todo of unsyncedTodos) {
        if (todo.deleted) {
          // Remove deleted todos after successful sync
          await todoCollection.delete(todo.id)
        } else {
          await todoCollection.update(todo.id, (draft) => {
            draft.synced = true
          })
        }
      }

      // Clear sync queue
      syncQueueRef.current.clear()

      setLastSyncTime(new Date())
      console.log('Sync successful:', result)
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
      
      // Retry after delay if online
      if (isOnline) {
        setTimeout(() => {
          syncToServer()
        }, 10000) // Retry after 10 seconds
      }
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing])

  // Fetch fresh data from server
  const fetchFromServer = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('fetchFromServer aborted: navigator reports offline')
      return;
    }

    try {
      const serverTodos = await fetchTodos();
      console.log(`Fetched ${serverTodos.length} todos from server`);

      // Access raw Dexie table
      const table = todoCollection.utils.getTable();
      const localTodos = (await table.toArray()) as unknown as TodoType[];

      console.log(`Fetched ${serverTodos.length} todos from server`);

      for (const serverTodo of serverTodos) {
        const localTodo = localTodos.find(t => t.id === serverTodo.id);

        if (!localTodo) {
          await todoCollection.insert({ ...serverTodo, synced: true });
        } else if (localTodo.synced) {
          if (serverTodo.version > localTodo.version) {
            await todoCollection.update(serverTodo.id, () => ({
              ...serverTodo,
              synced: true,
            }));
          }
        }
      }

      console.log('Fetch from server complete');
    } catch (error) {
      console.error('Fetch failed:', error);
    }
  }, [isOnline]);

  // Full sync: fetch then push
  const fullSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) {
      console.log('fullSync aborted: offline or already syncing')
      return
    }

    console.log('Starting full sync...')
    
    // First, fetch latest from server
    await fetchFromServer()
    
    // Then, push local changes
    await syncToServer()
  }, [isOnline, isSyncing, fetchFromServer, syncToServer])

  // Queue a todo for syncing
  const queueForSync = useCallback((todoId: string) => {
    syncQueueRef.current.add(todoId)
    debouncedSync()
  }, [debouncedSync])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      console.log('Back online!')
      setIsOnline(true)
      setSyncError(null)

      // Check server health
      const isHealthy = await checkHealth()
      if (isHealthy) {
        // Perform full sync when coming back online
        setTimeout(() => {
          fullSync()
        }, 1000)
      }
    }

    // If health check fails we still want to attempt syncing after a short delay
    // This helps when the health endpoint temporarily fails but the API is reachable
    const handleOnlineFallback = async () => {
      console.log('Back online (fallback) - attempting sync')
      setIsOnline(true)
      setSyncError(null)
      setTimeout(() => {
        fullSync()
      }, 2000)
    }

    const handleOffline = () => {
      console.log('Gone offline')
      setIsOnline(false)
    }

    // Handle force sync events
    const handleForceSync = () => {
      console.log('Force sync triggered')
      fullSync()
    }

    window.addEventListener('online', handleOnline)
  // Fallback listener in case health check blocks immediate sync
  window.addEventListener('online', handleOnlineFallback)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('force-sync', handleForceSync)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('online', handleOnlineFallback)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('force-sync', handleForceSync)
    }
  }, [fullSync])

  // Auto-sync every 30 seconds when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      // Wrap async logic in an IIFE
      (async () => {
        try {
          // Access the raw Dexie table
          const table = todoCollection.utils.getTable();
          const allTodos = (await table.toArray()) as unknown as TodoType[];

          // Check if there are unsynced todos
          const hasUnsynced = allTodos.some(todo => !todo.synced);
          if (hasUnsynced) {
            syncToServer();
          }
        } catch (err) {
          console.error('Error checking unsynced todos:', err);
        }
      })();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, syncToServer]);


  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    syncError,
    syncToServer,
    fetchFromServer,
    fullSync,
    queueForSync
  }
}