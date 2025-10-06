import React from 'react'
import { User } from '../types/types'
import { getUserAvatar, getUserDisplayName } from '../utils/userManager'

interface UserIndicatorProps {
  user?: User
  userId?: string
  userName?: string
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
}

export const UserIndicator: React.FC<UserIndicatorProps> = ({
  user,
  userId,
  userName,
  size = 'md',
  showName = false
}) => {
  // Create user object from available data
  const userObj: User = user || {
    id: userId || 'unknown',
    name: userName || 'Unknown User',
    color: '#6B7280'
  }

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-medium`}
        style={{ backgroundColor: userObj.color }}
        title={getUserDisplayName(userObj)}
      >
        {getUserAvatar(userObj)}
      </div>
      {showName && (
        <span className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
          {getUserDisplayName(userObj)}
        </span>
      )}
    </div>
  )
}
