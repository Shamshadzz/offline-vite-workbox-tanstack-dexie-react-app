/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffMultiplier?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onRetry
  } = options

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        throw lastError
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      )

      // Add jitter (±20%)
      const jitter = delay * (0.8 + Math.random() * 0.4)

      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(jitter)}ms`)
      
      await sleep(jitter)
    }
  }

  throw lastError
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }
}

/**
 * Queue for managing sequential async operations
 */
export class AsyncQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = false

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.process()
      }
    })
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        try {
          await task()
        } catch (error) {
          console.error('Queue task failed:', error)
        }
      }
    }

    this.processing = false
  }

  clear() {
    this.queue = []
  }

  get size() {
    return this.queue.length
  }
}