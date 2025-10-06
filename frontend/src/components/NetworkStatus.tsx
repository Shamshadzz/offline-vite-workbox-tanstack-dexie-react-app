import React from 'react'
import { useNetworkStatus } from '../services/useNetworkStatus'
import { Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react'

export const NetworkStatus: React.FC = () => {
  const { isOnline, effectiveType, downlink, rtt } = useNetworkStatus()

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />
    }
    
    if (effectiveType === '4g') {
      return <Wifi className="w-4 h-4 text-green-500" />
    }
    
    if (effectiveType === '3g') {
      return <Wifi className="w-4 h-4 text-yellow-500" />
    }
    
    return <AlertTriangle className="w-4 h-4 text-orange-500" />
  }

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline'
    }
    
    if (effectiveType === '4g') {
      return 'Online (4G)'
    }
    
    if (effectiveType === '3g') {
      return 'Online (3G)'
    }
    
    if (effectiveType === '2g') {
      return 'Online (2G)'
    }
    
    return 'Online'
  }

  const getStatusColor = () => {
    if (!isOnline) {
      return 'text-red-600 bg-red-50 border-red-200'
    }
    
    if (effectiveType === '4g') {
      return 'text-green-600 bg-green-50 border-green-200'
    }
    
    if (effectiveType === '3g') {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    }
    
    return 'text-orange-600 bg-orange-50 border-orange-200'
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor()}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {isOnline && downlink && (
        <span className="text-xs opacity-75">
          {downlink.toFixed(1)}Mbps
        </span>
      )}
    </div>
  )
}
