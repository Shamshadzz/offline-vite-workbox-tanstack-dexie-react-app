import React, { useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { todoCollection } from "../collections/db";
import { Todo as TodoType } from "../types/types";
import { TodoInput } from "../components/TodoInput";
import { TodoList } from "../components/TodoList";
import { ConflictResolver } from "../components/ConflictResolver";
import { NetworkStatus } from "../components/NetworkStatus";
import { SyncStatus } from "../components/SyncStatus";
import { UserSwitcher } from "../components/UserSwitcher";
import { useSync } from "../hooks/useSync";
import { getCurrentUser } from "../utils/userManager";
import { Clipboard } from "lucide-react";
import offlineQueue from '../utils/offlineQueue'
import { requestBackgroundSync } from '../utils/serviceWorkerRegistration'

export const TodoPage: React.FC = () => {
  const [newTodo, setNewTodo] = useState("");
  const currentUser = getCurrentUser();

  const { data: todos = [], isLoading, isError } = useLiveQuery((q) =>
    q.from({ todo: todoCollection }).select(({ todo }) => ({ ...todo }))
  );

  const visibleTodos = todos.filter((t) => !t.deleted)

  const {
    conflicts,
    showConflictResolver,
    handleConflictResolution,
    dismissConflictResolver,
  } = useSync();

  // 🔥 FIX: Simplified add todo with proper offline queue
  const addTodo = async () => {
    if (!newTodo.trim()) return;
    
    const now = new Date();
    const id = crypto.randomUUID()
    const todoData = {
      id,
      text: newTodo.trim(),
      completed: false,
      version: 1,
      synced: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      userId: currentUser.id,
      userName: currentUser.name,
    }

    // Insert into local DB immediately
    await todoCollection.insert(todoData);
    setNewTodo("");

    // Save to offline queue
    try {
      const op = { 
        type: 'CREATE', 
        todo: { 
          ...todoData,
          createdAt: todoData.createdAt.toISOString(),
          updatedAt: todoData.updatedAt.toISOString()
        } 
      }
      await offlineQueue.addOperation(op)
      console.log('✅ Saved to offline queue')

      // Request background sync (SW will handle when online)
      await requestBackgroundSync('sync-todos')
      
      // Trigger immediate sync if online
      if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('force-sync'))
      }
    } catch (err) {
      console.error('Failed to queue operation:', err)
    }
  };

  // 🔥 FIX: Simplified toggle todo
  const toggleTodo = async (todoRef: TodoType & { id: string }) => {
    const updatedData = {
      completed: !todoRef.completed,
      version: (todoRef.version || 0) + 1,
      updatedAt: new Date(),
      synced: false,
      userId: currentUser.id,
      userName: currentUser.name,
    }

    await todoCollection.update(todoRef.id, (draft) => {
      Object.assign(draft, updatedData)
    });

    try {
      const op = { 
        type: 'UPDATE', 
        todo: { 
          id: todoRef.id, 
          completed: updatedData.completed,
          version: updatedData.version,
          updatedAt: updatedData.updatedAt.toISOString()
        } 
      }
      await offlineQueue.addOperation(op)
      await requestBackgroundSync('sync-todos')
      
      if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('force-sync'))
      }
    } catch (err) {
      console.error('Failed to queue toggle operation:', err)
    }
  };

  // 🔥 FIX: Simplified delete todo (tombstone)
  const deleteTodo = async (id: string) => {
    const updatedData = {
      deleted: true,
      synced: false,
      version: 0, // Will be incremented in update
      updatedAt: new Date(),
      userId: currentUser.id,
      userName: currentUser.name,
    }

    await todoCollection.update(id, (draft) => {
      draft.deleted = true
      draft.synced = false
      draft.version = (draft.version || 0) + 1
      draft.updatedAt = updatedData.updatedAt
      draft.userId = updatedData.userId
      draft.userName = updatedData.userName
    })

    try {
      const op = { 
        type: 'DELETE', 
        todo: { 
          id,
          deleted: true,
          updatedAt: updatedData.updatedAt.toISOString()
        } 
      }
      await offlineQueue.addOperation(op)
      await requestBackgroundSync('sync-todos')
      
      if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('force-sync'))
      }
    } catch (err) {
      console.error('Failed to queue delete operation:', err)
    }
  };

  // 🔥 FIX: Simplified edit todo
  const editTodo = async (id: string, newText: string) => {
    if (!newText.trim()) return;
    
    const updatedData = {
      text: newText.trim(),
      version: 0, // Will be calculated
      updatedAt: new Date(),
      synced: false,
      userId: currentUser.id,
      userName: currentUser.name,
    }

    await todoCollection.update(id, (draft) => {
      draft.text = updatedData.text
      draft.version = (draft.version || 0) + 1
      draft.updatedAt = updatedData.updatedAt
      draft.synced = false
      draft.userId = updatedData.userId
      draft.userName = updatedData.userName
    });

    try {
      const op = { 
        type: 'UPDATE', 
        todo: { 
          id, 
          text: updatedData.text,
          updatedAt: updatedData.updatedAt.toISOString()
        } 
      }
      await offlineQueue.addOperation(op)
      await requestBackgroundSync('sync-todos')
      
      if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('force-sync'))
      }
    } catch (err) {
      console.error('Failed to queue edit operation:', err)
    }
  }

  const unsyncedCount = todos.filter((t) => !t.synced).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">📝</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-700 font-semibold text-lg">Loading todos...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white/90 backdrop-blur-xl border border-red-200/50 rounded-3xl p-10 shadow-2xl text-center max-w-md">
          <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-orange-100 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-lg">
            <span className="text-3xl">⚠️</span>
          </div>
          <div className="text-red-600 text-xl font-bold mb-3">
            Error loading todos
          </div>
          <p className="text-gray-600 text-lg">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <span className="text-3xl">📝</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent mb-4 drop-shadow-sm">
            Todo App
          </h1>
          <p className="text-gray-600 text-lg mb-6">Stay productive with offline-first todos ✨</p>
          
          <div className="flex justify-center items-center gap-4 flex-wrap">
            <NetworkStatus />
            <UserSwitcher />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Input Section */}
          <div className="p-8 border-b border-gray-100/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
            <TodoInput value={newTodo} setValue={setNewTodo} onAdd={addTodo} />
          </div>

          {/* Todo List */}
          <div className="min-h-[300px] p-8">
            {visibleTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
                  <Clipboard className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
                </div>
                <p className="text-2xl font-bold text-gray-700 mb-2">No todos yet 🎉</p>
                <p className="text-lg text-gray-500">Add your first todo above to get started</p>
              </div>
            ) : (
              <TodoList todos={visibleTodos} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={editTodo} />
            )}
          </div>

          {/* Footer with sync status */}
          {todos.length > 0 && (
            <div className="px-8 py-6 bg-gradient-to-r from-gray-50/80 to-blue-50/80 border-t border-gray-100/50 backdrop-blur-sm">
              <div className="flex items-center justify-center">
                <SyncStatus />
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {visibleTodos.length > 0 && (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: "Total", value: visibleTodos.length, color: "text-blue-600", bg: "from-blue-50 to-blue-100", icon: "📊" },
              { label: "Active", value: visibleTodos.filter((t) => !t.completed).length, color: "text-green-600", bg: "from-green-50 to-emerald-100", icon: "⚡" },
              { label: "Completed", value: visibleTodos.filter((t) => t.completed).length, color: "text-purple-600", bg: "from-purple-50 to-violet-100", icon: "✅" },
              { label: "Pending", value: unsyncedCount, color: "text-amber-600", bg: "from-amber-50 to-orange-100", icon: "⏳" },
            ].map((stat, i) => (
              <div
                key={i}
                className={`bg-gradient-to-br ${stat.bg} backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 text-center hover:scale-105 hover:shadow-xl transition-all duration-300`}
              >
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className={`text-3xl font-extrabold ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-sm font-semibold text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflict Resolver Modal */}
      {showConflictResolver && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={handleConflictResolution}
          onDismiss={dismissConflictResolver}
          currentUser={currentUser.name}
        />
      )}
    </div>
  );
};