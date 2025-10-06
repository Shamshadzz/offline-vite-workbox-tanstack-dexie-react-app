import { Todo as TodoType, ConflictInfo, User } from '../types/types'

export type ConflictResolutionStrategy = 
  | 'server-wins'
  | 'client-wins'
  | 'last-write-wins'
  | 'manual'

export interface EnhancedConflictInfo extends ConflictInfo {
  localUser?: string
  serverUser?: string
  conflictTimestamp: Date
}

/**
 * Detect conflicts between local and server versions with user information
 */
export function detectConflicts(
  localTodos: TodoType[],
  serverTodos: TodoType[],
  localUser?: string,
  serverUser?: string
): EnhancedConflictInfo[] {
  const conflicts: EnhancedConflictInfo[] = []

  for (const localTodo of localTodos) {
    const serverTodo = serverTodos.find(t => t.id === localTodo.id)

    if (!serverTodo) {
      // Todo exists locally but not on server - not a conflict, just needs sync
      continue
    }

    // Check for conflicts
    if (localTodo.version !== serverTodo.version && !localTodo.synced) {
      // Version mismatch - potential conflict
      
      if (localTodo.deleted && !serverTodo.deleted) {
        conflicts.push({
          todoId: localTodo.id,
          localVersion: localTodo,
          serverVersion: serverTodo,
          conflictType: 'deletion',
          localUser,
          serverUser,
          conflictTimestamp: new Date()
        })
      } else if (
        localTodo.text !== serverTodo.text ||
        localTodo.completed !== serverTodo.completed
      ) {
        conflicts.push({
          todoId: localTodo.id,
          localVersion: localTodo,
          serverVersion: serverTodo,
          conflictType: 'content',
          localUser,
          serverUser,
          conflictTimestamp: new Date()
        })
      } else if (localTodo.version < serverTodo.version) {
        conflicts.push({
          todoId: localTodo.id,
          localVersion: localTodo,
          serverVersion: serverTodo,
          conflictType: 'version',
          localUser,
          serverUser,
          conflictTimestamp: new Date()
        })
      }
    }
  }

  return conflicts
}

/**
 * Resolve a single conflict based on strategy
 */
export function resolveConflict(
  conflict: ConflictInfo,
  strategy: ConflictResolutionStrategy
): TodoType {
  switch (strategy) {
    case 'server-wins':
      return { ...conflict.serverVersion, synced: true }

    case 'client-wins':
      return { 
        ...conflict.localVersion, 
        version: conflict.serverVersion.version + 1,
        synced: false 
      }

    case 'last-write-wins':
      const localTime = conflict.localVersion.updatedAt?.getTime() ?? 0
      const serverTime = conflict.serverVersion.updatedAt?.getTime() ?? 0
      
      if (localTime > serverTime) {
        return { 
          ...conflict.localVersion, 
          version: conflict.serverVersion.version + 1,
          synced: false 
        }
      } else {
        return { ...conflict.serverVersion, synced: true }
      }

    case 'manual':
      // Return local version for manual resolution
      // The app should prompt the user
      return conflict.localVersion

    default:
      return conflict.serverVersion
  }
}

/**
 * Merge todos with conflict resolution
 */
export function mergeTodos(
  localTodos: TodoType[],
  serverTodos: TodoType[],
  strategy: ConflictResolutionStrategy = 'last-write-wins',
  localUser?: string,
  serverUser?: string
): {
  merged: TodoType[]
  conflicts: EnhancedConflictInfo[]
  resolutions: Map<string, TodoType>
} {
  const conflicts = detectConflicts(localTodos, serverTodos, localUser, serverUser)
  const resolutions = new Map<string, TodoType>()
  const merged: TodoType[] = []

  // Create a map of local todos
  const localMap = new Map(localTodos.map(t => [t.id, t]))
  const serverMap = new Map(serverTodos.map(t => [t.id, t]))

  // Process all unique todo IDs
  const allIds = new Set([
    ...localTodos.map(t => t.id),
    ...serverTodos.map(t => t.id)
  ])

  for (const id of allIds) {
    const localTodo = localMap.get(id)
    const serverTodo = serverMap.get(id)
    const conflict = conflicts.find(c => c.todoId === id)

    if (conflict) {
      // Resolve conflict
      const resolved = resolveConflict(conflict, strategy)
      resolutions.set(id, resolved)
      merged.push(resolved)
    } else if (localTodo && serverTodo) {
      // No conflict - prefer server version if local is synced
      if (localTodo.synced) {
        merged.push({ ...serverTodo, synced: true })
      } else {
        merged.push(localTodo)
      }
    } else if (localTodo) {
      // Only exists locally
      merged.push(localTodo)
    } else if (serverTodo) {
      // Only exists on server
      merged.push({ ...serverTodo, synced: true })
    }
  }

  return { merged, conflicts, resolutions }
}

/**
 * Three-way merge for advanced conflict resolution
 */
export function threeWayMerge(
  base: TodoType | null,
  local: TodoType,
  remote: TodoType
): TodoType {
  // If no base, use last-write-wins
  if (!base) {
    const localTime = local.updatedAt?.getTime() ?? 0
    const remoteTime = remote.updatedAt?.getTime() ?? 0
    return localTime > remoteTime ? local : remote
  }

  // Field-by-field merge
  const merged: TodoType = { ...remote }

  // Text: prefer the one that changed from base
  if (local.text !== base.text && remote.text === base.text) {
    merged.text = local.text
  } else if (remote.text !== base.text && local.text === base.text) {
    merged.text = remote.text
  } else if (local.text !== remote.text) {
    // Both changed - use newer
    const localTime = local.updatedAt?.getTime() ?? 0
    const remoteTime = remote.updatedAt?.getTime() ?? 0
    merged.text = localTime > remoteTime ? local.text : remote.text
  }

  // Completed: prefer the one that changed from base
  if (local.completed !== base.completed && remote.completed === base.completed) {
    merged.completed = local.completed
  } else if (remote.completed !== base.completed && local.completed === base.completed) {
    merged.completed = remote.completed
  } else if (local.completed !== remote.completed) {
    // Both changed - use newer
    const localTime = local.updatedAt?.getTime() ?? 0
    const remoteTime = remote.updatedAt?.getTime() ?? 0
    merged.completed = localTime > remoteTime ? local.completed : remote.completed
  }

  // Deleted: if either deleted, mark as deleted
  if (local.deleted || remote.deleted) {
    merged.deleted = true
  }

  // Use highest version number + 1
  merged.version = Math.max(local.version, remote.version) + 1
  merged.updatedAt = new Date()
  merged.synced = false

  return merged
}