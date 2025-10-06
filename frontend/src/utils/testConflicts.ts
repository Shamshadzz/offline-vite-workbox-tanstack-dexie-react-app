// Test utility for conflict resolution
import { Todo } from '../types/types'
import { detectConflicts } from './conflictResolver'

export const createTestConflict = (): { localTodos: Todo[], serverTodos: Todo[] } => {
  const baseTodo: Todo = {
    id: 'test-todo-1',
    text: 'Original todo text',
    completed: false,
    version: 1,
    synced: true,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    userId: 'user-1',
    userName: 'Alice'
  }

  // Local version (modified by user)
  const localTodos: Todo[] = [{
    ...baseTodo,
    text: 'Modified by Alice',
    completed: true,
    version: 2,
    synced: false,
    updatedAt: new Date('2024-01-01T11:00:00Z'),
    userId: 'user-1',
    userName: 'Alice'
  }]

  // Server version (modified by different user)
  const serverTodos: Todo[] = [{
    ...baseTodo,
    text: 'Modified by Bob',
    completed: false,
    version: 2,
    synced: true,
    updatedAt: new Date('2024-01-01T10:30:00Z'),
    userId: 'user-2',
    userName: 'Bob'
  }]

  return { localTodos, serverTodos }
}

export const testConflictDetection = () => {
  const { localTodos, serverTodos } = createTestConflict()
  
  console.log('Testing conflict detection...')
  console.log('Local todos:', localTodos)
  console.log('Server todos:', serverTodos)
  
  const conflicts = detectConflicts(
    localTodos,
    serverTodos,
    'Alice',
    'Bob'
  )
  
  console.log('Detected conflicts:', conflicts)
  
  if (conflicts.length > 0) {
    console.log('✅ Conflict detection working!')
    console.log('Conflict type:', conflicts[0].conflictType)
    console.log('Local user:', conflicts[0].localUser)
    console.log('Server user:', conflicts[0].serverUser)
  } else {
    console.log('❌ No conflicts detected')
  }
  
  return conflicts
}

// Run test if in development
if (import.meta.env.DEV) {
  console.log('🧪 Running conflict detection test...')
  testConflictDetection()
}
