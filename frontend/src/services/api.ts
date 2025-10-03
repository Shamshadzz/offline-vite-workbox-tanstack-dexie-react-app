import axios, { AxiosError } from 'axios'
import { Todo as TodoType } from '../types/types'
import { retryWithBackoff } from '../utils/retryUtils'

const API_URL = import.meta.env.VITE_API_URL

// Enhanced axios configuration
axios.defaults.timeout = 10000
axios.defaults.headers.post['Content-Type'] = 'application/json'

// Request interceptor for logging
axios.interceptors.request.use(
  (config) => {
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
axios.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ${response.config.url}`)
    return response
  },
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Request timeout')
    } else if (error.response) {
      console.error(`❌ ${error.response.status} ${error.config?.url}`)
    } else if (error.request) {
      console.error('❌ No response received')
    }
    return Promise.reject(error)
  }
)

/**
 * Fetch all todos from server with retry logic
 */
export const fetchTodos = async (): Promise<TodoType[]> => {
  return retryWithBackoff(
    async () => {
      const res = await axios.get(`${API_URL}/todos`)
      console.log(`Fetched ${res.data.length} todos from server`);
      
      // Ensure every todo has all required TodoType properties
      const todos = Array.isArray(res.data) ? res.data : []
      
      return todos.map((t: any) => ({
        id: t.id ?? '',
        text: t.text ?? '',
        completed: !!t.completed,
        version: t.version ?? 1,
        synced: t.synced ?? true,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
        userId: t.userId,
        deleted: t.deleted ?? false
      }))
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retrying fetchTodos (${attempt}/3):`, error.message)
      }
    }
  )
}

/**
 * Sync todos to server with retry logic
 */
export const syncTodos = async (operations: any[]) => {
  if (operations.length === 0) {
    return { synced: 0, failed: 0 }
  }

  return retryWithBackoff(
    async () => {
      const res = await axios.post(`${API_URL}/sync`, { operations })
      return res.data
    },
    {
      maxRetries: 3,
      initialDelay: 2000,
      onRetry: (attempt, error) => {
        console.log(`Retrying syncTodos (${attempt}/3):`, error.message)
      }
    }
  )
}

/**
 * Sync a single todo (for backwards compatibility)
 */
export const syncSingleTodo = async (operation: any) => {
  return syncTodos([operation])
}

/**
 * Health check endpoint
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const res = await axios.get(`${API_URL}/health`, { timeout: 5000 })
    return res.data.status === 'OK'
  } catch (error) {
    console.error('Health check failed:', error)
    return false
  }
}

/**
 * Check if server is reachable (quick ping)
 */
export const pingServer = async (): Promise<boolean> => {
  try {
    await axios.get(`${API_URL}/health`, { 
      timeout: 3000,
      headers: { 'Cache-Control': 'no-cache' }
    })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get server statistics
 */
export const getServerStats = async () => {
  try {
    const res = await axios.get(`${API_URL}/stats`)
    return res.data
  } catch (error) {
    console.error('Failed to get server stats:', error)
    throw error
  }
}

/**
 * Batch delete todos
 */
export const batchDeleteTodos = async (ids: string[]) => {
  return retryWithBackoff(
    async () => {
      const res = await axios.post(`${API_URL}/batch-delete`, { ids })
      return res.data
    },
    {
      maxRetries: 2,
      initialDelay: 1000
    }
  )
}

/**
 * Clear completed todos on server
 */
export const clearCompletedOnServer = async () => {
  return retryWithBackoff(
    async () => {
      const res = await axios.post(`${API_URL}/clear-completed`)
      return res.data
    },
    {
      maxRetries: 2,
      initialDelay: 1000
    }
  )
}