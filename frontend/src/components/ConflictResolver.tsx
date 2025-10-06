import React, { useState } from 'react'
import { ConflictInfo, Todo, ConflictResolution } from '../types/types'
import { AlertTriangle, User, Clock, CheckCircle, XCircle, Merge } from 'lucide-react'

interface ConflictResolverProps {
  conflicts: ConflictInfo[]
  onResolve: (resolution: ConflictResolution) => void
  onDismiss: () => void
  currentUser: string
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  onDismiss,
  currentUser
}) => {
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map())

  const handleResolution = (conflict: ConflictInfo, resolution: 'local' | 'server' | 'merge') => {
    let resolvedTodo: Todo | undefined

    switch (resolution) {
      case 'local':
        resolvedTodo = { ...conflict.localVersion, synced: false }
        break
      case 'server':
        resolvedTodo = { ...conflict.serverVersion, synced: true }
        break
      case 'merge':
        // Simple merge: combine text and use server's completion status
        resolvedTodo = {
          ...conflict.serverVersion,
          text: `${conflict.localVersion.text} | ${conflict.serverVersion.text}`,
          version: Math.max(conflict.localVersion.version, conflict.serverVersion.version) + 1,
          synced: false,
          updatedAt: new Date()
        }
        break
    }

    const conflictResolution: ConflictResolution = {
      todoId: conflict.todoId,
      resolution,
      resolvedTodo,
      resolvedBy: currentUser,
      resolvedAt: new Date()
    }

    setResolutions(prev => new Map(prev.set(conflict.todoId, conflictResolution)))
  }

  const handleResolveAll = () => {
    resolutions.forEach((resolution) => {
      onResolve(resolution)
    })
    onDismiss()
  }

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'content':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'deletion':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'version':
        return <Clock className="w-5 h-5 text-blue-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />
    }
  }

  const getConflictDescription = (conflict: ConflictInfo) => {
    switch (conflict.conflictType) {
      case 'content':
        return 'Content was modified by both users'
      case 'deletion':
        return 'One user deleted while another modified'
      case 'version':
        return 'Version mismatch detected'
      default:
        return 'Unknown conflict type'
    }
  }

  const formatUser = (user?: string) => {
    return user || 'Unknown User'
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Conflict Resolution</h2>
              <p className="text-orange-100 text-lg">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected between users
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {conflicts.map((conflict, index) => {
            const resolution = resolutions.get(conflict.todoId)
            
            return (
              <div key={conflict.todoId} className="mb-8 p-6 border border-gray-200/50 rounded-2xl bg-gradient-to-br from-gray-50/80 to-blue-50/80 backdrop-blur-sm shadow-lg">
                {/* Conflict Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
                    {getConflictIcon(conflict.conflictType)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Conflict #{index + 1}: {conflict.localVersion.text}
                    </h3>
                    <p className="text-sm text-gray-600 font-medium">
                      {getConflictDescription(conflict)}
                    </p>
                  </div>
                </div>

                {/* Versions Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Local Version */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/50 rounded-2xl p-6 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-bold text-blue-900 text-lg">
                        Your Version ({formatUser(conflict.localUser)})
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">
                        <strong>Text:</strong> {conflict.localVersion.text}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Status:</strong> {conflict.localVersion.completed ? 'Completed' : 'Active'}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Version:</strong> {conflict.localVersion.version}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Updated:</strong> {formatTime(conflict.localVersion.updatedAt || new Date())}
                      </p>
                    </div>
                  </div>

                  {/* Server Version */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200/50 rounded-2xl p-6 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-bold text-green-900 text-lg">
                        Server Version ({formatUser(conflict.serverUser)})
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">
                        <strong>Text:</strong> {conflict.serverVersion.text}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Status:</strong> {conflict.serverVersion.completed ? 'Completed' : 'Active'}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Version:</strong> {conflict.serverVersion.version}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Updated:</strong> {formatTime(conflict.serverVersion.updatedAt || new Date())}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div className="space-y-4">
                  <p className="text-lg font-bold text-gray-800 mb-4">Choose resolution:</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleResolution(conflict, 'local')}
                      className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                        resolution?.resolution === 'local'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200'
                          : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 hover:from-blue-200 hover:to-blue-300'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Keep Your Version
                    </button>
                    <button
                      onClick={() => handleResolution(conflict, 'server')}
                      className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                        resolution?.resolution === 'server'
                          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200'
                          : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 hover:from-green-200 hover:to-green-300'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Use Server Version
                    </button>
                    <button
                      onClick={() => handleResolution(conflict, 'merge')}
                      className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                        resolution?.resolution === 'merge'
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200'
                          : 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 hover:from-purple-200 hover:to-purple-300'
                      }`}
                    >
                      <Merge className="w-4 h-4 inline mr-2" />
                      Merge Both
                    </button>
                  </div>
                </div>

                {/* Resolution Preview */}
                {resolution && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-gray-100 to-blue-50 rounded-xl border border-gray-200/50">
                    <p className="text-sm font-bold text-gray-800 mb-2">Resolution Preview:</p>
                    <p className="text-sm text-gray-700 font-medium">
                      {resolution.resolvedTodo?.text} 
                      {resolution.resolution === 'merge' && ' (merged)'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-gray-50/80 to-blue-50/80 px-8 py-6 flex justify-between items-center border-t border-gray-200/50">
          <div className="text-sm font-semibold text-gray-700">
            {resolutions.size} of {conflicts.length} conflicts resolved
          </div>
          <div className="flex gap-4">
            <button
              onClick={onDismiss}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveAll}
              disabled={resolutions.size !== conflicts.length}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
            >
              Resolve All Conflicts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
