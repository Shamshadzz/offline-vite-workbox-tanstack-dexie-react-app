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
    <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-xl border border-white/20">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="✍️ Add a new task..."
        className="flex-1 bg-transparent text-gray-800 placeholder-gray-500 focus:outline-none text-lg font-medium"
      />
      <button
        onClick={onAdd}
        disabled={!value.trim()}
        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-3 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  )
}
