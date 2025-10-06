import { useEffect, useCallback, useState, useRef } from 'react'
import { todoCollection } from '../collections/db'
import { syncTodos, fetchTodos, checkHealth } from '../services/api'
import { Todo as TodoType, ConflictInfo } from '../types/types'
import { debounce } from '../utils/retryUtils'
import { detectConflicts, mergeTodos } from '../utils/conflictResolver'
import { getCurrentUser } from '../utils/userManager'

export const useSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [showConflictResolver, setShowConflictResolver] = useState(false)
  const syncQueueRef = useRef<Set<string>>(new Set())
  const bcRef = useRef<BroadcastChannel | null>(null)

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
  const localTable = todoCollection.utils.getTable(); // raw Dexie table
  const allTodos = (await localTable.toArray()) as unknown as TodoType[];
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

      // Apply server's canonical results (authoritative).
      // The server may return full todo objects, tombstones (deleted flags),
      // or simple { deleted: id } responses depending on its logic. Handle all cases.
      const serverResults = result && Array.isArray(result.results) ? result.results : []

  // Use the raw Dexie table for reliable upsert/delete operations
  const serverTable = todoCollection.utils.getTable()

      if (serverResults.length > 0) {
        // notify other tabs that a sync just happened so they can refresh
        try {
          if (!bcRef.current && typeof BroadcastChannel !== 'undefined') {
            bcRef.current = new BroadcastChannel('todo-sync')
          }
        } catch (err) {
          // BroadcastChannel may be unavailable in some environments
        }

        for (const r of serverResults) {
          try {
            // Case A: server returns a canonical todo object with deleted flag
            if (r && (r.deleted === true || r.deleted === 'true')) {
              const idToDelete = r.id || r.todo?.id || r.deleted
              if (idToDelete) await serverTable.delete(idToDelete)
              continue
            }

            // Case B: server returns an object like { deleted: '<id>' }
            if (r && r.deleted && typeof r.deleted === 'string' && !r.id) {
              await serverTable.delete(r.deleted)
              continue
            }

            // Case C: server returns a full todo object (create/update)
            if (r && r.id) {
              const serverTodo = {
                ...r,
                createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
                updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
                synced: true,
              }

              // Upsert the canonical server version into local DB
              await serverTable.put(serverTodo)
              continue
            }

            // Fallback: if server returned something unexpected, ignore it but log
            console.warn('Unexpected sync result item from server:', r)
          } catch (err) {
            console.error('Error applying server sync result for item', r, err)
          }
        }

        // Broadcast that sync completed and send ids so other tabs can refresh
        try {
          const ids = serverResults.map((x: any) => x?.id).filter(Boolean)
          if (bcRef.current && ids.length > 0) {
            bcRef.current.postMessage({ type: 'synced', ids })
          }
        } catch (err) {
          /* ignore */
        }
      } else {
        // No per-item results returned -> fall back to optimistic behaviour
        for (const todo of unsyncedTodos) {
          if (todo.deleted) {
            await todoCollection.delete(todo.id)
          } else {
            await todoCollection.update(todo.id, (draft) => {
              draft.synced = true
            })
          }
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

  // ...moved below to after fetchFromServer declaration

  // Fetch fresh data from server with conflict detection
  const fetchFromServer = useCallback(async (force = false) => {
    if (!navigator.onLine) {
      console.log('fetchFromServer aborted: navigator reports offline')
      return;
    }

    try {
      const serverTodos = await fetchTodos();
      console.log(`Fetched ${serverTodos.length} todos from server (force=${force})`);

      // Access raw Dexie table
      const table = todoCollection.utils.getTable();
      const localTodos = (await table.toArray()) as unknown as TodoType[];

      // Get current user for conflict detection
      const currentUser = getCurrentUser();

      // Detect conflicts only when not forcing server wins
      if (!force) {
        const detectedConflicts = detectConflicts(
          localTodos,
          serverTodos,
          currentUser.name,
          'Server User'
        );

        if (detectedConflicts.length > 0) {
          console.log(`Found ${detectedConflicts.length} conflicts`);
          setConflicts(detectedConflicts);
          setShowConflictResolver(true);
          return; // Wait for user to resolve conflicts
        }
      }

      // Merge: if force=true, prefer server canonical copy and replace local table
      // force = true
      if (force) {
        console.log('force=true: replacing local Dexie table with server items')
        // Transform server items into DB-ready rows
        const transformed = serverTodos.map((s: any) => ({
          ...s,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
          synced: true,
        }))

        try {
          // Clear low-level table then insert via collection API so react-db
          // change notifications fire and components update.
          const table = todoCollection.utils.getTable()
          await table.clear()
          for (const item of transformed) {
            try {
              await todoCollection.insert(item)
            } catch (e) {
              // If insert fails for existing key, fall back to update
              try { await todoCollection.update(item.id, () => item) } catch (err) { /* ignore */ }
            }
          }
          console.log(`Replaced local DB with ${transformed.length} server items (via collection.insert)`)
        } catch (err) {
          console.error('Error replacing local DB during force fetch', err)
        }
      } else {
        for (const serverTodo of serverTodos) {
          const localTodo = localTodos.find(t => t.id === serverTodo.id);

          if (!localTodo) {
            await todoCollection.insert({ ...serverTodo, synced: true });
          } else {
            // Apply server if:
            // - local is already synced and server has newer version
            // - server has newer version than local
            const shouldApply = localTodo.synced || serverTodo.version > (localTodo.version || 0);
            if (shouldApply) {
              await todoCollection.update(serverTodo.id, () => ({
                ...serverTodo,
                synced: true,
              }));
            }
          }
        }
      }

      console.log('Fetch from server complete');
    } catch (error) {
      console.error('Fetch failed:', error);
    }
  }, [isOnline]);

  // Full sync: fetch then push
  const fullSync = useCallback(async (forceFetch = false) => {
    if (!navigator.onLine || isSyncing) {
      console.log('fullSync aborted: offline or already syncing')
      return
    }

    console.log('Starting full sync...', { forceFetch })
    
    // First, fetch latest from server (optionally force server-win)
    await fetchFromServer(forceFetch)
    
    // Then, push local changes
    await syncToServer()
  }, [isOnline, isSyncing, fetchFromServer, syncToServer])

  // Create BroadcastChannel and visibility/focus listeners to refresh from server
  useEffect(() => {
    // Setup BroadcastChannel to react to syncs from other tabs
    let bc: BroadcastChannel | null = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('todo-sync')
        bc.onmessage = (ev) => {
          try {
            if (ev.data?.type === 'synced' || ev.data?.type === 'invalidate') {
              // Another tab synced — refresh local view from server
              fetchFromServer()
            }
          } catch (e) {
            console.error('BC message handler error', e)
          }
        }
        bcRef.current = bc
      }
    } catch (err) {
      // ignore if BroadcastChannel unsupported
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFromServer()
      }
    }

    const handleFocus = () => {
      fetchFromServer()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      try { bc?.close() } catch (e) { /* noop */ }
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchFromServer])

  // Queue a todo for syncing
  const queueForSync = useCallback((todoId: string) => {
    syncQueueRef.current.add(todoId)
    debouncedSync()
  }, [debouncedSync])

  // Handle conflict resolution
  const handleConflictResolution = useCallback(async (resolution: any) => {
    try {
      // Apply the resolved todo to the collection
      if (resolution.resolvedTodo) {
        await todoCollection.update(resolution.todoId, () => resolution.resolvedTodo)
      }

      // Remove resolved conflict
      setConflicts(prev => prev.filter(c => c.todoId !== resolution.todoId))
      
      // If all conflicts resolved, hide the resolver
      if (conflicts.length <= 1) {
        setShowConflictResolver(false)
        setConflicts([])
        // Continue with sync after resolving conflicts
        setTimeout(() => {
          fullSync()
        }, 1000)
      }
    } catch (error) {
      console.error('Error resolving conflict:', error)
    }
  }, [conflicts.length, fullSync])

  // Dismiss conflict resolver
  const dismissConflictResolver = useCallback(() => {
    setShowConflictResolver(false)
    setConflicts([])
  }, [])

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
    conflicts,
    showConflictResolver,
    syncToServer,
    fetchFromServer,
    fullSync,
    queueForSync,
    handleConflictResolution,
    dismissConflictResolver
  }
}