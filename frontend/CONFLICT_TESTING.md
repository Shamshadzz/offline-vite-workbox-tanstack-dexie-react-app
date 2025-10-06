# Conflict Resolution Testing Guide

This guide explains how to test the conflict resolution functionality in the Todo app.

## Features Implemented

### 1. User Management

- **User Switcher**: Click the user indicator in the header to switch between different users
- **User Identification**: Each todo shows which user created/modified it
- **User Colors**: Each user has a unique color for easy identification

### 2. Conflict Detection

- **Version Conflicts**: When the same todo is modified by different users
- **Content Conflicts**: When different users change the text or completion status
- **Deletion Conflicts**: When one user deletes while another modifies

### 3. Conflict Resolution UI

- **Visual Comparison**: Side-by-side comparison of local vs server versions
- **Resolution Options**:
  - **Keep Your Version**: Use the local changes
  - **Use Server Version**: Accept the server changes
  - **Merge Both**: Combine both versions (text gets merged)
- **User Information**: Shows which user made which changes

### 4. Offline/Online Handling

- **Network Status**: Shows current connection status
- **Sync Status**: Displays sync progress and errors
- **Automatic Sync**: Syncs when coming back online
- **Conflict Detection**: Automatically detects conflicts during sync

## Testing Scenarios

### Scenario 1: Basic Conflict Resolution

1. **Setup**: Open the app in two different browser tabs/windows
2. **Create Todo**: Add a todo in the first tab
3. **Switch User**: Use the user switcher to become a different user
4. **Modify Todo**: Edit the same todo in the second tab
5. **Go Offline**: Disconnect from the internet
6. **Make Changes**: Modify the todo in both tabs while offline
7. **Go Online**: Reconnect to the internet
8. **Expected**: Conflict resolution dialog should appear

### Scenario 2: Multiple User Conflicts

1. **Setup**: Open multiple tabs with different users
2. **Create Todo**: Add a todo in one tab
3. **Go Offline**: Disconnect from the internet
4. **Modify in Multiple Tabs**: Edit the same todo in different tabs with different users
5. **Go Online**: Reconnect to the internet
6. **Expected**: Conflict resolution dialog with multiple conflicts

### Scenario 3: Deletion Conflicts

1. **Setup**: Create a todo and sync it
2. **Go Offline**: Disconnect from the internet
3. **Delete in One Tab**: Delete the todo in one tab
4. **Modify in Another Tab**: Edit the same todo in another tab
5. **Go Online**: Reconnect to the internet
6. **Expected**: Conflict resolution dialog for deletion vs modification

## How to Test

### Step 1: Start the Application

```bash
# Start the backend
cd backend
npm start

# Start the frontend (in another terminal)
cd frontend
npm run dev
```

### Step 2: Simulate Multiple Users

1. Open the app in multiple browser tabs
2. Use the user switcher to assign different users to each tab
3. Create and modify todos in different tabs
4. Go offline and make conflicting changes
5. Go online to trigger conflict resolution

### Step 3: Test Conflict Resolution

1. When conflicts are detected, the conflict resolution dialog will appear
2. Review the side-by-side comparison
3. Choose your preferred resolution:
   - **Keep Your Version**: Use your local changes
   - **Use Server Version**: Accept server changes
   - **Merge Both**: Combine both versions
4. Click "Resolve All Conflicts" to apply your choices

## Expected Behavior

### Conflict Detection

- Conflicts are automatically detected during sync
- Visual indicators show which user made which changes
- Timestamps show when changes were made

### Conflict Resolution

- Clear side-by-side comparison of versions
- User-friendly resolution options
- Preview of resolved content
- Batch resolution for multiple conflicts

### Sync Status

- Real-time sync status indicators
- Network status display
- Error handling and retry logic
- Offline mode support

## Troubleshooting

### Common Issues

1. **Conflicts not detected**: Ensure you're making changes while offline
2. **Sync not working**: Check network status and server connection
3. **User switching not working**: Refresh the page after switching users

### Debug Information

- Check browser console for sync logs
- Network tab shows sync requests
- Local storage contains user and todo data

## Technical Details

### Conflict Resolution Strategies

- **Last Write Wins**: Uses timestamp comparison
- **Server Wins**: Always uses server version
- **Client Wins**: Always uses local version
- **Manual**: User chooses resolution

### Data Flow

1. **Local Changes**: Stored in DexieJS (IndexedDB)
2. **Sync Detection**: Automatic when coming online
3. **Conflict Detection**: Compares versions and content
4. **Resolution**: User-guided conflict resolution
5. **Sync**: Applies resolved changes to server

### User Management

- **User Generation**: Random names and colors
- **User Persistence**: Stored in localStorage
- **User Switching**: Simulates different users for testing
