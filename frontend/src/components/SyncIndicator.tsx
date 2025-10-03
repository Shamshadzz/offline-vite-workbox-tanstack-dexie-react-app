import React from 'react'

interface SyncIndicatorProps {
  isOnline: boolean
  isSyncing: boolean
  unsyncedCount: number
  lastSyncTime: Date | null
  syncError: string | null
  onManualSync: () => void
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  isOnline,
  isSyncing,
  unsyncedCount,
  lastSyncTime,
  syncError,
  onManualSync
}) => {
  const getStatusIcon = () => {
    if (!isOnline) return '🔴'
    if (isSyncing) return '🔄'
    if (unsyncedCount > 0) return '⏳'
    return '✅'
  }

  const getStatusText = () => {
    if (!isOnline) return 'Offline - Changes saved locally'
    if (isSyncing) return 'Syncing to server...'
    if (unsyncedCount > 0) return `${unsyncedCount} change${unsyncedCount !== 1 ? 's' : ''} pending`
    return 'All changes synced'
  }

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600 bg-red-50 border-red-200'
    if (isSyncing) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (unsyncedCount > 0) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  return (
    <div className={`p-3 rounded-lg border ${getStatusColor()} transition-all`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xl">{getStatusIcon()}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{getStatusText()}</p>
            {lastSyncTime && isOnline && (
              <p className="text-xs opacity-70">
                Last synced: {lastSyncTime.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {isOnline && (
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className={`btn ${isSyncing ? 'btn-ghost px-3 py-1.5 text-xs' : 'px-3 py-1.5 text-xs font-medium rounded transition-all shrink-0 bg-white hover:bg-gray-50 shadow-sm border'}`}
          >
            {isSyncing ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⟳</span>
                Syncing
              </span>
            ) : (
              '🔄 Sync Now'
            )}
          </button>
        )}
      </div>

      {syncError && (
        <div className="mt-2 p-2 bg-white rounded text-xs text-red-700 border border-red-200">
          <strong>Error:</strong> {syncError}
        </div>
      )}

      {!isOnline && unsyncedCount > 0 && (
        <div className="mt-2 text-xs opacity-80">
          💡 Changes will sync automatically when you're back online
        </div>
      )}
    </div>
  )
}