import React, { useState, useEffect } from 'react'
import { 
  getStorageInfo, 
  formatBytes, 
  isStoragePersistent, 
  requestPersistentStorage,
  clearAllData,
  exportData,
  createBackup,
  StorageInfo
} from '../utils/storageManager'
import { todoCollection } from '../collections/db'
import { Todo as TodoType } from '../types/types'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [isPersistent, setIsPersistent] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    unsynced: 0,
    deleted: 0
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    // Get storage info
    const info = await getStorageInfo()
    setStorageInfo(info)

    // Check persistence
    const persistent = await isStoragePersistent()
    setIsPersistent(persistent)

    // Get todo stats
    // Access the raw Dexie table
    const table = todoCollection.utils.getTable();
    const todos = (await table.toArray()) as unknown as TodoType[];
    setStats({
      total: todos.length,
      active: todos.filter((t: TodoType) => !t.completed && !t.deleted).length,
      completed: todos.filter((t: TodoType) => t.completed && !t.deleted).length,
      unsynced: todos.filter((t: TodoType) => !t.synced).length,
      deleted: todos.filter((t: TodoType) => t.deleted).length
    })
  }

  const handleRequestPersistence = async () => {
    const granted = await requestPersistentStorage()
    setIsPersistent(granted)
    if (granted) {
      alert('✅ Storage persistence granted!')
    } else {
      alert('⚠️ Storage persistence not available')
    }
  }

  const handleExportData = async () => {
    // Access the raw Dexie table
    const table = todoCollection.utils.getTable();
    const todos = (await table.toArray()) as unknown as TodoType[];
    exportData(todos, `todos-export-${new Date().toISOString()}.json`)
  }

  const handleBackupDatabase = async () => {
    const backup = await createBackup('tanstack-todo-db')
    if (backup) {
      const url = URL.createObjectURL(backup)
      const a = document.createElement('a')
      a.href = url
      a.download = `database-backup-${new Date().toISOString()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleClearData = async () => {
    const success = await clearAllData()
    if (success) {
      alert('✅ All data cleared. Page will reload.')
      window.location.reload()
    }
  }

  const handleForceSync = async () => {
    // Trigger a custom event that the sync hook can listen to
    window.dispatchEvent(new CustomEvent('force-sync'))
    alert('🔄 Sync triggered!')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Settings & Debug</h2>
          <button
            onClick={onClose}
            className="btn-icon text-gray-500 hover:text-gray-700 text-2xl hover:bg-gray-100 rounded-full p-2 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Storage Information */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Storage</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {storageInfo ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Used:</span>
                    <span className="font-mono">{formatBytes(storageInfo.usage)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quota:</span>
                    <span className="font-mono">{formatBytes(storageInfo.quota)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available:</span>
                    <span className="font-mono">{formatBytes(storageInfo.available)}</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Usage</span>
                      <span>{storageInfo.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          storageInfo.percentage > 80 ? 'bg-red-500' :
                          storageInfo.percentage > 60 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Storage API not supported</p>
              )}
              
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <div>
                  <span className="text-gray-600">Persistent:</span>
                  <span className={`ml-2 font-semibold ${isPersistent ? 'text-green-600' : 'text-amber-600'}`}>
                    {isPersistent ? '✓ Yes' : '⚠️ No'}
                  </span>
                </div>
                {!isPersistent && (
                  <button
                    onClick={handleRequestPersistence}
                    className="btn btn-primary text-sm px-3 py-1"
                  >
                    Request
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Data Statistics */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Todos</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-purple-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-amber-600">{stats.unsynced}</div>
                <div className="text-sm text-gray-600">Unsynced</div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={handleForceSync}
                className="btn btn-primary w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Force Sync Now
              </button>
              <button
                onClick={handleExportData}
                className="btn btn-primary w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Export Data (JSON)
              </button>
              <button
                onClick={handleBackupDatabase}
                className="btn btn-primary w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Backup Database
              </button>
              <button
                onClick={loadData}
                className="btn w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Refresh Stats
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section>
            <h3 className="text-lg font-semibold mb-3 text-red-600">Danger Zone</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 mb-3">
                This will permanently delete all local data including todos, settings, and cached information.
              </p>
              <button
                onClick={handleClearData}
                className="btn btn-primary w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Clear All Local Data
              </button>
            </div>
          </section>

          {/* App Info */}
          <section>
            <h3 className="text-lg font-semibold mb-3">About</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-mono">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Database:</span>
                <span className="font-mono">tanstack-todo-db</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Collection:</span>
                <span className="font-mono">Dexie + TanStack</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}