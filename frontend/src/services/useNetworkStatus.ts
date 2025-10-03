import { useState, useEffect, useCallback } from 'react'

interface NetworkStatus {
  isOnline: boolean
  effectiveType: string | null
  downlink: number | null
  rtt: number | null
  saveData: boolean
}

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    effectiveType: null,
    downlink: null,
    rtt: null,
    saveData: false
  })

  const updateNetworkInfo = useCallback(() => {
    const connection = (navigator as any).connection 
      || (navigator as any).mozConnection 
      || (navigator as any).webkitConnection

    if (connection) {
      setStatus(prev => ({
        ...prev,
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
        saveData: connection.saveData || false
      }))
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }))
      updateNetworkInfo()
    }

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }))
    }

    const connection = (navigator as any).connection 
      || (navigator as any).mozConnection 
      || (navigator as any).webkitConnection

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (connection) {
      connection.addEventListener('change', updateNetworkInfo)
      updateNetworkInfo()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo)
      }
    }
  }, [updateNetworkInfo])

  return status
}

// Hook for detecting network speed and quality
export const useNetworkQuality = () => {
  const { effectiveType, downlink, rtt } = useNetworkStatus()

  const quality = effectiveType === '4g' ? 'good' 
    : effectiveType === '3g' ? 'moderate'
    : effectiveType === '2g' ? 'poor'
    : effectiveType === 'slow-2g' ? 'very-poor'
    : 'unknown'

  const shouldDefer = quality === 'poor' || quality === 'very-poor'
  const shouldOptimize = quality !== 'good'

  return {
    quality,
    effectiveType,
    downlink,
    rtt,
    shouldDefer,
    shouldOptimize
  }
}