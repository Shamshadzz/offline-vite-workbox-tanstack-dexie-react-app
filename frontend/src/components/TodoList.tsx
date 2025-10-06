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
  );
};

interface TodoItemProps {
  todo: TodoType;
  onToggle: (todo: TodoType & { id: string }) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
  const updated = todo.updatedAt ? new Date(todo.updatedAt) : null;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState<string>(todo.text || "");

  return (
    <div
      className="
        group flex flex-col sm:flex-row sm:items-start gap-4 
        p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-sm shadow-md 
        border border-white/20 md:hover:shadow-xl md:hover:border-blue-200/50 
        transition-all duration-300 md:hover:scale-[1.02]
      "
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0 sm:mt-1 flex justify-center sm:justify-start">
        <button
          onClick={() => onToggle(todo as TodoType & { id: string })}
          aria-pressed={todo.completed}
          aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
          className={`
            flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 
            transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
            ${todo.completed
              ? "bg-gradient-to-r from-green-500 to-emerald-500 border-green-500 shadow-lg"
              : "bg-white border-gray-300 group-hover:border-blue-400 group-hover:shadow-md"}
          `}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Text / Edit */}
          {!isEditing ? (
            <p
              className={`text-base sm:text-lg break-words ${
                todo.completed
                  ? "line-through text-gray-500"
                  : "text-gray-800 font-semibold md:group-hover:text-blue-600"
              }`}
            >
              {todo.text || <span className="italic text-gray-400">(no content)</span>}
            </p>
          ) : (
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onEdit && onEdit(todo.id, editText);
                  setIsEditing(false);
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditText(todo.text || "");
                }
              }}
              className="w-full px-3 py-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-blue-300 text-sm sm:text-base"
            />
          )}

          {/* Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 sm:gap-3 mt-2 sm:mt-0">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                todo.synced
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-amber-100 text-amber-700 border border-amber-200"
              }`}
            >
              {todo.synced ? "✅ Synced" : "⏳ Pending"}
            </span>

            <button
              onClick={() => setIsEditing(true)}
              aria-label="Edit todo"
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-50 md:hover:shadow-sm transition-all duration-200"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(todo.id)}
              aria-label="Delete todo"
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 md:hover:shadow-sm transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span className="font-medium">v{todo.version}</span>
            {updated && <span className="text-gray-500">{updated.toLocaleString()}</span>}
          </div>

          <UserIndicator
            userId={todo.userId}
            userName={todo.userName}
            size="sm"
            showName={true}
          />
        </div>
      </div>
    </div>
  );
};
