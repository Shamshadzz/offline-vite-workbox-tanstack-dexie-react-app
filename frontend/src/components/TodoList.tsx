// components/TodoList.tsx
import React, { useState } from "react";
import { Todo as TodoType } from "../types/types";
import { Check, Circle, Trash2, Edit2 } from "lucide-react";
import { UserIndicator } from "./UserIndicator";

interface TodoListProps {
  todos: TodoType[];
  onToggle: (todo: TodoType & { id: string }) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, onToggle, onDelete, onEdit }) => {
  return (
    <div className="space-y-3">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
      ))}
      {todos.length === 0 && (
        <div className="p-6 bg-white rounded-lg shadow-sm text-center text-gray-500">
          No todos yet — add your first task above ✨
        </div>
      )}
    </div>
  )
}

interface TodoItemProps {
  todo: TodoType;
  onToggle: (todo: TodoType & { id: string }) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
  const updated = todo.updatedAt ? new Date(todo.updatedAt) : null
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState<string>(todo.text || '')

  return (
    <div className="group flex items-start gap-4 p-5 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg border border-white/20 hover:shadow-xl hover:border-blue-200/50 transition-all duration-300 hover:scale-[1.02]">
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-1">
        <button
          onClick={() => onToggle(todo as TodoType & { id: string })}
          aria-pressed={todo.completed}
          aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            todo.completed
              ? "bg-gradient-to-r from-green-500 to-emerald-500 border-green-500 shadow-lg"
              : "bg-white border-gray-300 group-hover:border-blue-400 group-hover:shadow-md"
          }`}
        >
          {todo.completed ? (
            <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
          ) : (
            <Circle className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Todo Content */}
        <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          {!isEditing ? (
            <p
              className={`text-lg truncate ${
                todo.completed
                  ? "line-through text-gray-500"
                  : "text-gray-800 font-semibold group-hover:text-blue-600"
              }`}
            >
              {todo.text || (
                <span className="italic text-gray-400">(no content)</span>
              )}
            </p>
          ) : (
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onEdit && onEdit(todo.id, editText)
                  setIsEditing(false)
                } else if (e.key === 'Escape') {
                  setIsEditing(false)
                  setEditText(todo.text || '')
                }
              }}
              className="w-full px-3 py-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-blue-300"
            />
          )}

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all duration-200 ${
                todo.synced
                  ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200 shadow-sm"
                  : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200 shadow-sm"
              }`}
            >
              {todo.synced ? "✅ Synced" : "⏳ Pending"}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              aria-label="Edit todo"
              title="Edit"
              className="p-2.5 rounded-xl text-gray-600 hover:bg-gray-50 hover:shadow-md transition-all duration-200 hover:scale-110"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(todo.id)}
              aria-label="Delete todo"
              className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 hover:shadow-md transition-all duration-200 hover:scale-110"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="font-medium">v{todo.version}</span>
            {updated && (
              <span className="text-gray-500">{updated.toLocaleString()}</span>
            )}
          </div>
          
          {/* User indicator */}
          <UserIndicator
            userId={todo.userId}
            userName={todo.userName}
            size="sm"
            showName={true}
          />
        </div>
      </div>
    </div>
  )
}
