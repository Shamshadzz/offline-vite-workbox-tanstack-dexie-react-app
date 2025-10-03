// components/TodoList.tsx
import React from "react";
import { Todo as TodoType } from "../types/types";
import { Check, Circle, Trash2 } from "lucide-react";

interface TodoListProps {
  todos: TodoType[];
  onToggle: (todo: TodoType & { id: string }) => void;
  onDelete: (id: string) => void;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, onToggle, onDelete }) => {
  return (
    <div className="space-y-3">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
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
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  const updated = todo.updatedAt ? new Date(todo.updatedAt) : null

  return (
    <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all">
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-1">
        <button
          onClick={() => onToggle(todo as TodoType & { id: string })}
          aria-pressed={todo.completed}
          aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            todo.completed
              ? "bg-green-500 border-green-500"
              : "bg-white border-gray-300 group-hover:border-indigo-400"
          }`}
        >
          {todo.completed ? (
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          ) : (
            <Circle className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Todo Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p
            className={`text-base truncate ${
              todo.completed
                ? "line-through text-gray-400"
                : "text-gray-900 font-medium group-hover:text-indigo-600"
            }`}
          >
            {todo.text || (
              <span className="italic text-gray-400">(no content)</span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                todo.synced
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-amber-100 text-amber-700 border border-amber-200"
              }`}
            >
              {todo.synced ? "Synced" : "Pending"}
            </span>
            <button
              onClick={() => onDelete(todo.id)}
              aria-label="Delete todo"
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
          <span className="font-medium">v{todo.version}</span>
          {updated && (
            <span className="text-gray-500">{updated.toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}
