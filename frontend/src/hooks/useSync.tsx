import { useEffect, useCallback, useState, useRef } from 'react'
import { todoCollection } from '../collections/db'
import { fetchTodos, checkHealth, syncTodos } from '../services/api'
import { Todo as TodoType, ConflictInfo } from '../types/types'
import { detectConflicts, resolveConflict } from '../utils/conflictResolver'
import { getCurrentUser } from '../utils/userManager'
import offlineQueue from '../utils/offlineQueue'
import { requestBackgroundSync } from '../utils/serviceWorkerRegistration'

export const useSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [showConflictResolver, setShowConflictResolver] = useState(false)
  const syncInProgressRef = useRef(false)
  const bcRef = useRef<BroadcastChannel | null>(null)

  // 🔥 FIX 1: Simplified sync to server - single source of truth
  const syncToServer = useCallback(async () => {
    // Prevent concurrent syncs
    if (!navigator.onLine || syncInProgressRef.current) {
      console.log('Sync skipped: offline or already syncing')
      return
    }

    syncInProgressRef.current = true
    setIsSyncing(true)
    setSyncError(null)

    try {
      const table = todoCollection.utils.getTable()
      const allTodos = (await table.toArray()) as unknown as TodoType[]
      const unsyncedTodos = allTodos.filter(t => !t.synced)

      if (unsyncedTodos.length === 0) {
        console.log('No unsynced todos')
        setIsSyncing(false)
        syncInProgressRef.current = false
        return
      }

      console.log(`🔄 Syncing ${unsyncedTodos.length} todos to server...`)

      const operations = unsyncedTodos.map((todo: TodoType) => ({
        type: todo.deleted ? 'DELETE' : todo.version === 1 ? 'CREATE' : 'UPDATE',
        todo: {
          ...todo,
          createdAt: todo.createdAt?.toISOString(),
          updatedAt: todo.updatedAt?.toISOString()
        }
      }))

      const result = await syncTodos(operations)
      const serverResults = result?.results || []

      // Apply server's canonical results
      for (const r of serverResults) {
        try {
          if (r?.deleted === true || r?.deleted === 'true') {
            const idToDelete = r.id || r.todo?.id
            if (idToDelete) await table.delete(idToDelete)
            continue
          }

          if (r?.deleted && typeof r.deleted === 'string' && !r.id) {
            await table.delete(r.deleted)
            continue
          }

          if (r?.id) {
            const serverTodo = {
              ...r,
              createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
              updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
              synced: true,
            }
            await table.put(serverTodo)
            continue
          }
        } catch (err) {
          console.error('Error applying server result:', err)
        }
      }

      // Clear offline queue
      await offlineQueue.clearAllOperations()

      // Broadcast sync completion
      if (bcRef.current) {
        bcRef.current.postMessage({ type: 'synced', ids: serverResults.map((x: any) => x?.id).filter(Boolean) })
      }

      setLastSyncTime(new Date())
      console.log('✅ Sync successful')
    } catch (error) {
      console.error('❌ Sync failed:', error)
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
      
      // Fallback to SW background sync
      try {
        await requestBackgroundSync('sync-todos')
        console.log('📱 Requested SW background sync')
      } catch (err) {
        console.error('SW background sync registration failed', err)
      }
    } finally {
      setIsSyncing(false)
      syncInProgressRef.current = false
    }
  }, [])

  // 🔥 FIX 2: Fetch from server with proper conflict detection
  const fetchFromServer = useCallback(async (forceServerWins = false) => {
    if (!navigator.onLine) {
      console.log('❌ Fetch aborted: offline')
      return
    }

    try {
      const serverTodos = await fetchTodos()
      console.log(`📥 Fetched ${serverTodos.length} todos from server`)

      const table = todoCollection.utils.getTable()
      const localTodos = (await table.toArray()) as unknown as TodoType[]
      const currentUser = getCurrentUser()

      // 🔥 FIX 3: Only detect conflicts if NOT forcing server wins AND have unsynced data
      const hasUnsyncedLocal = localTodos.some(t => !t.synced)
      
      if (!forceServerWins && hasUnsyncedLocal) {
        const detectedConflicts = detectConflicts(
          localTodos,
          serverTodos,
          currentUser.name,
          'Server'
        )

        if (detectedConflicts.length > 0) {
          console.log(`⚠️ Found ${detectedConflicts.length} conflicts`)
          setConflicts(detectedConflicts)
          setShowConflictResolver(true)
          return // Wait for user resolution
        }
      }

      // 🔥 FIX 4: Smart merge - only overwrite synced items or when forcing
      if (forceServerWins) {
        console.log('🔄 Force mode: replacing with server data')
        await table.clear()
        
        for (const serverTodo of serverTodos) {
          const transformed = {
            ...serverTodo,
            createdAt: serverTodo.createdAt ? new Date(serverTodo.createdAt) : new Date(),
            updatedAt: serverTodo.updatedAt ? new Date(serverTodo.updatedAt) : new Date(),
            synced: true,
          }
          await table.put(transformed)
        }
      } else {
        // Merge intelligently
        const localMap = new Map(localTodos.map(t => [t.id, t]))
        
        for (const serverTodo of serverTodos) {
          const localTodo = localMap.get(serverTodo.id)
          
          if (!localTodo) {
            // New from server
            await table.put({ 
              ...serverTodo,
              createdAt: serverTodo.createdAt ? new Date(serverTodo.createdAt) : new Date(),
              updatedAt: serverTodo.updatedAt ? new Date(serverTodo.updatedAt) : new Date(),
              synced: true 
            })
          } else if (localTodo.synced) {
            // Local is synced, safe to update with server version
            await table.put({
              ...serverTodo,
              createdAt: serverTodo.createdAt ? new Date(serverTodo.createdAt) : new Date(),
              updatedAt: serverTodo.updatedAt ? new Date(serverTodo.updatedAt) : new Date(),
              synced: true
            })
          }
          // If local is unsynced, keep local version (will sync later)
        }
      }

      console.log('✅ Fetch complete')
    } catch (error) {
      console.error('❌ Fetch failed:', error)
    }
  }, [])

  // 🔥 FIX 5: Simplified full sync
  const fullSync = useCallback(async (forceFetch = false) => {
    if (!navigator.onLine || syncInProgressRef.current) {
      console.log('Full sync skipped: offline or syncing')
      return
    }

    console.log('🔄 Starting full sync...')
    
    // First push local changes
    await syncToServer()
    
    // Then fetch server updates
    await fetchFromServer(forceFetch)
  }, [syncToServer, fetchFromServer])

  // 🔥 FIX 6: Handle conflict resolution properly
  const handleConflictResolution = useCallback(async (resolution: any) => {
    try {
      const conflict = conflicts.find(c => c.todoId === resolution.todoId)
      if (!conflict) return

      let resolvedTodo: TodoType

      if (resolution.resolution === 'local') {
        resolvedTodo = resolveConflict(conflict, 'client-wins')
      } else if (resolution.resolution === 'server') {
        resolvedTodo = resolveConflict(conflict, 'server-wins')
      } else {
        resolvedTodo = resolution.resolvedTodo || resolveConflict(conflict, 'last-write-wins')
      }

      // Apply resolution
      await todoCollection.update(resolution.todoId, () => resolvedTodo)

      // Remove resolved conflict
      setConflicts(prev => prev.filter(c => c.todoId !== resolution.todoId))
      
      // Hide resolver if all conflicts resolved
      if (conflicts.length <= 1) {
        setShowConflictResolver(false)
        setConflicts([])
        
        // Continue sync after resolution
        setTimeout(() => fullSync(), 500)
      }
    } catch (error) {
      console.error('Error resolving conflict:', error)
    }
  }, [conflicts, fullSync])

  const dismissConflictResolver = useCallback(() => {
    setShowConflictResolver(false)
    // Keep conflicts in state so user can see them later
  }, [])

  // 🔥 FIX 7: Setup broadcast channel and listeners
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('todo-sync')
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'synced' || ev.data?.type === 'invalidate') {
            console.log('📡 Other tab synced, refreshing...')
            fetchFromServer(false)
          }
        }
        bcRef.current = bc
      }
    } catch (err) {
      console.warn('BroadcastChannel not supported')
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFromServer(false)
      }
    }

    const handleFocus = () => fetchFromServer(false)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      try { bc?.close() } catch (e) { /* noop */ }
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchFromServer])

  // 🔥 FIX 8: Online/offline handlers
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🟢 Back online!')
      setIsOnline(true)
      setSyncError(null)

      const isHealthy = await checkHealth()
      if (isHealthy) {
        setTimeout(() => fullSync(false), 1000)
      }
    }

    const handleOffline = () => {
      console.log('🔴 Gone offline')
      setIsOnline(false)
    }

    const handleForceSync = () => {
      console.log('🔄 Force sync triggered')
      fullSync(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('force-sync', handleForceSync)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('force-sync', handleForceSync)
    }
  }, [fullSync])

  // 🔥 FIX 9: Auto-sync every 30 seconds (only if unsynced data exists)
  useEffect(() => {
    if (!isOnline) return

    const interval = setInterval(async () => {
      try {
        const table = todoCollection.utils.getTable()
        const allTodos = (await table.toArray()) as unknown as TodoType[]
        const hasUnsynced = allTodos.some(todo => !todo.synced)
        
        if (hasUnsynced) {
          console.log('⏰ Auto-sync: unsynced data found')
          syncToServer()
        }
      } catch (err) {
        console.error('Auto-sync check failed:', err)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isOnline, syncToServer])

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
    handleConflictResolution,
    dismissConflictResolver
  }
}