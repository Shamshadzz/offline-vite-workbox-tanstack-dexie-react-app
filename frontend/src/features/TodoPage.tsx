import React, { useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { todoCollection } from "../collections/db";
import { Todo as TodoType } from "../types/types";
import { TodoInput } from "../components/TodoInput";
import { TodoList } from "../components/TodoList";
import { Clipboard } from "lucide-react";

export const TodoPage: React.FC = () => {
  const [newTodo, setNewTodo] = useState("");

  const { data: todos = [], isLoading, isError } = useLiveQuery((q) =>
    q.from({ todo: todoCollection }).select(({ todo }) => ({ ...todo }))
  );

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const now = new Date();
    todoCollection.insert({
      id: crypto.randomUUID(),
      text: newTodo.trim(),
      completed: false,
      version: 1,
      synced: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });
    setNewTodo("");
    // Trigger sync attempt (useful when returning online)
    try {
      window.dispatchEvent(new CustomEvent('force-sync'))
    } catch (e) {
      /* noop */
    }
  };

  const toggleTodo = (todoRef: TodoType & { id: string }) => {
    todoCollection.update(todoRef.id, (draft) => {
      draft.completed = !draft.completed;
      draft.version += 1;
      draft.updatedAt = new Date();
      draft.synced = false;
    });
    try { window.dispatchEvent(new CustomEvent('force-sync')) } catch (e) { /* noop */ }
  };

  const deleteTodo = (id: string) => {
    todoCollection.delete(id)
    try { window.dispatchEvent(new CustomEvent('force-sync')) } catch (e) { /* noop */ }
  };

  const unsyncedCount = todos.filter((t) => !t.synced).length;

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="text-gray-700 font-medium">Loading todos...</span>
        </div>
      </div>
    );

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white/80 backdrop-blur-xl border border-red-200 rounded-2xl p-8 shadow-lg text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">
            ⚠️ Error loading todos
          </div>
          <p className="text-gray-600">Please try refreshing the page</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3 drop-shadow-sm">
            Todo App
          </h1>
          <p className="text-gray-600 text-lg">Stay productive with offline-first todos ✨</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Input Section */}
          <div className="p-6 border-b border-gray-100">
            <TodoInput value={newTodo} setValue={setNewTodo} onAdd={addTodo} />
          </div>

          {/* Todo List */}
          <div className="min-h-[300px] p-6">
            {todos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Clipboard className="w-20 h-20 mb-4 text-gray-300" strokeWidth={1.5} />

                <p className="text-xl font-medium">No todos yet 🎉</p>
                <p className="text-sm">Add your first todo above to get started</p>
              </div>
            ) : (
              <TodoList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />
            )}
          </div>

          {/* Footer with sync status */}
          {todos.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                {unsyncedCount > 0 ? (
                  <>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <span>
                      Syncing {unsyncedCount} change{unsyncedCount !== 1 ? "s" : ""}...
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>All changes synced ✅</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {todos.length > 0 && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: "Total", value: todos.length, color: "text-blue-600" },
              { label: "Active", value: todos.filter((t) => !t.completed).length, color: "text-green-600" },
              { label: "Completed", value: todos.filter((t) => t.completed).length, color: "text-purple-600" },
              { label: "Pending", value: unsyncedCount, color: "text-amber-600" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/90 backdrop-blur rounded-xl p-6 shadow-md border border-gray-100 text-center hover:scale-105 transition-transform duration-200"
              >
                <div className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
