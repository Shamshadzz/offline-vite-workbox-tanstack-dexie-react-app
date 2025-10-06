// types/types.ts

export interface Todo {
  id: string
  text: string
  completed: boolean
  userId?: string
  userName?: string
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
  localUser?: string
  serverUser?: string
  conflictTimestamp: Date
}

export interface User {
  id: string
  name: string
  color: string
}

export interface ConflictResolution {
  todoId: string
  resolution: 'local' | 'server' | 'merge'
  resolvedTodo?: Todo
  resolvedBy: string
  resolvedAt: Date
}