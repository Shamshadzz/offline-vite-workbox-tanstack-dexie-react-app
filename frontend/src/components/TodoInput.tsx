// components/TodoInput.tsx
import { Plus } from 'lucide-react'
import React from 'react'

interface TodoInputProps {
  value: string
  setValue: (value: string) => void
  onAdd: () => void
}

export const TodoInput: React.FC<TodoInputProps> = ({ value, setValue, onAdd }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onAdd()
    }
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-full px-5 py-3 shadow-lg">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="✍️ Add a new task..."
        className="flex-1 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none text-base"
      />
      <button
        onClick={onAdd}
        disabled={!value.trim()}
        className="btn btn-primary rounded-full p-3 shadow-md hover:shadow-xl hover:scale-110 transition disabled:opacity-40"
      >
        <Plus />
      </button>
    </div>

  )
}
