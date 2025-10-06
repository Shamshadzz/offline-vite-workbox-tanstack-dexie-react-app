import React from 'react'
import { useSync } from '../hooks/useSync'
import { CheckCircle, AlertTriangle, Clock, WifiOff } from 'lucide-react'

export const SyncStatus: React.FC = () => {
  const { isOnline, isSyncing, syncError, lastSyncTime } = useSync()

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-gray-500" />
    }
    
    if (isSyncing) {
      return <Clock className="w-4 h-4 text-blue-500 animate-spin" />
    }
    
    if (syncError) {
      return <AlertTriangle className="w-4 h-4 text-red-500" />
    }
    
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline - Changes saved locally'
    }
    
    if (isSyncing) {
      return 'Syncing...'
    }
    
    if (syncError) {
      return `Sync failed: ${syncError}`
    }
    
    if (lastSyncTime) {
      return `Last synced: ${lastSyncTime.toLocaleTimeString()}`
    }
    
    return 'All changes synced'
  }

  const getStatusColor = () => {
    if (!isOnline) {
      return 'text-gray-600 bg-gray-50 border-gray-200'
    }
    
    if (isSyncing) {
      return 'text-blue-600 bg-blue-50 border-blue-200'
    }
    
    if (syncError) {
      return 'text-red-600 bg-red-50 border-red-200'
    }
    
    return 'text-green-600 bg-green-50 border-green-200'
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor()}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  )
}
