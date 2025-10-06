import { User } from '../types/types'

// Generate a random user ID and name
const generateUser = (): User => {
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
  
  return {
    id: crypto.randomUUID(),
    name: randomName,
    color: randomColor
  }
}

// Get or create current user
export const getCurrentUser = (): User => {
  const stored = localStorage.getItem('currentUser')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      // Invalid stored data, create new user
    }
  }
  
  const newUser = generateUser()
  localStorage.setItem('currentUser', JSON.stringify(newUser))
  return newUser
}

// Update current user
export const updateCurrentUser = (updates: Partial<User>): User => {
  const current = getCurrentUser()
  const updated = { ...current, ...updates }
  localStorage.setItem('currentUser', JSON.stringify(updated))
  return updated
}

// Get user by ID (for display purposes)
export const getUserById = (userId: string): User | null => {
  if (userId === getCurrentUser().id) {
    return getCurrentUser()
  }
  
  // For now, return a default user for other users
  // In a real app, you'd fetch this from a user service
  return {
    id: userId,
    name: 'Other User',
    color: '#6B7280'
  }
}

// Generate user avatar
export const getUserAvatar = (user: User): string => {
  return user.name.charAt(0).toUpperCase()
}

// Get user display name
export const getUserDisplayName = (user: User): string => {
  return user.name
}
