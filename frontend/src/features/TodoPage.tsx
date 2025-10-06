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

export const TodoPage: React.FC = () => {
  const [newTodo, setNewTodo] = useState("");
  const currentUser = getCurrentUser();

  const { data: todos = [], isLoading, isError } = useLiveQuery((q) =>
    q.from({ todo: todoCollection }).select(({ todo }) => ({ ...todo }))
  );

  // Exclude deleted (tombstoned) todos from the UI list so they are
  // still present locally for syncing but not shown to the user.
  const visibleTodos = todos.filter((t) => !t.deleted)

  const {
    conflicts,
    showConflictResolver,
    handleConflictResolution,
    dismissConflictResolver,
    queueForSync
  } = useSync();

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const now = new Date();
    const id = crypto.randomUUID()
    todoCollection.insert({
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
    });
    setNewTodo("");
    // Queue for sync (debounced)
    try { queueForSync(id); console.log('Queued todo for sync', id) } catch (e) { try { window.dispatchEvent(new CustomEvent('force-sync')) } catch (err) { /* noop */ } }
  };

  const toggleTodo = (todoRef: TodoType & { id: string }) => {
    todoCollection.update(todoRef.id, (draft) => {
      draft.completed = !draft.completed;
      draft.version += 1;
      draft.updatedAt = new Date();
      draft.synced = false;
      draft.userId = currentUser.id;
      draft.userName = currentUser.name;
    });
    try { window.dispatchEvent(new CustomEvent('force-sync')) } catch (e) { /* noop */ }
  };

  const deleteTodo = async (id: string) => {
    const currentUserLocal = getCurrentUser()
    // Mark as deleted (tombstone) so sync will send a DELETE op to server.
    await todoCollection.update(id, (draft) => {
      draft.deleted = true
      draft.synced = false
      draft.version = (draft.version || 0) + 1
      draft.updatedAt = new Date()
      draft.userId = currentUserLocal.id
      draft.userName = currentUserLocal.name
    })
    // Queue for sync (debounced) rather than forcing immediate sync event
    try { queueForSync(id) } catch (e) { /* fallback to force-sync */ try { window.dispatchEvent(new CustomEvent('force-sync')) } catch (err) { /* noop */ } }
  };

  const editTodo = async (id: string, newText: string) => {
    if (!newText.trim()) return;
    const currentUserLocal = getCurrentUser();
    await todoCollection.update(id, (draft) => {
      draft.text = newText.trim();
      draft.version = (draft.version || 0) + 1;
      draft.updatedAt = new Date();
      draft.synced = false;
      draft.userId = currentUserLocal.id;
      draft.userName = currentUserLocal.name;
    });
    try { queueForSync(id) } catch (e) { try { window.dispatchEvent(new CustomEvent('force-sync')) } catch (err) { /* noop */ } }
  }

  const unsyncedCount = todos.filter((t) => !t.synced).length;

  if (isLoading)
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

  if (isError)
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
          
          {/* Network Status and User Switcher */}
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
              { label: "Total", value: todos.length, color: "text-blue-600", bg: "from-blue-50 to-blue-100", icon: "📊" },
              { label: "Active", value: todos.filter((t) => !t.completed).length, color: "text-green-600", bg: "from-green-50 to-emerald-100", icon: "⚡" },
              { label: "Completed", value: todos.filter((t) => t.completed).length, color: "text-purple-600", bg: "from-purple-50 to-violet-100", icon: "✅" },
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
