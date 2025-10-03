// types/types.ts

export interface Todo {
  id: string
  text: string
  completed: boolean
  userId?: number
  version: number
  createdAt?: Date
  updatedAt?: Date
  synced: boolean
  deleted?: boolean
}

export type TodoFilter = 'all' | 'active' | 'completed'

export interface SyncOperation {
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  todo: Todo
}

export interface SyncResult {
  synced: number
  failed: number
  conflicts?: ConflictInfo[]
}

export interface ConflictInfo {
  todoId: string
  localVersion: Todo
  serverVersion: Todo
  conflictType: 'content' | 'deletion' | 'version'
}