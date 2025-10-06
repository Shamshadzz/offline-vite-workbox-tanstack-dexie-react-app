import React, { useState } from 'react'
import { getCurrentUser, updateCurrentUser } from '../utils/userManager'
import { User } from '../types/types'
import { User as UserIcon, RefreshCw } from 'lucide-react'

export const UserSwitcher: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(getCurrentUser())
  const [isOpen, setIsOpen] = useState(false)

  const switchUser = (newUser: User) => {
    setCurrentUser(newUser)
    updateCurrentUser(newUser)
    setIsOpen(false)
    // Force a page refresh to update all components
    window.location.reload()
  }

  const generateNewUser = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ]
    
    const names = [
      'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
      'Ivy', 'Jack', 'Kate', 'Leo', 'Maya', 'Noah', 'Olivia', 'Paul'
    ]
    
    const randomName = names[Math.floor(Math.random() * names.length)]
    const randomColor = colors[Math.floor(Math.random() * colors.length)]
    
    const newUser: User = {
      id: crypto.randomUUID(),
      name: randomName,
      color: randomColor
    }
    
    switchUser(newUser)
  }

  return (
    <div className="relative ">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: currentUser.color }}
        >
          {currentUser.name.charAt(0)}
        </div>
        <span className="text-sm font-medium text-gray-700">{currentUser.name}</span>
        <UserIcon className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">Switch User</h3>
            <p className="text-sm text-gray-500">Simulate different users for testing conflicts</p>
          </div>
          
          <div className="p-3">
            <button
              onClick={generateNewUser}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Generate New User
            </button>
          </div>
          
          <div className="p-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Current user: <strong>{currentUser.name}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This simulates different users making changes to test conflict resolution.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
