import { createCollection } from '@tanstack/react-db'
import { Todo as TodoInterface } from '../types/types'
import { dexieCollectionOptions, DexieUtils } from "tanstack-dexie-db-collection"
import { Todo as TodoType } from '../types/types'
import { z } from "zod"

const API_URL = import.meta.env.VITE_API_URL

export const todoSchema: z.ZodType<TodoInterface> = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  version: z.number(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  synced: z.boolean(),
  deleted: z.boolean().optional(),
})

// ✅ Create Dexie-backed collection with optimized configuration
export const todoCollection = createCollection({
  ...dexieCollectionOptions({
    id: "todos",
    schema: todoSchema,
    getKey: (todo) => todo.id,
    dbName: "tanstack-todo-db",
    tableName: "todos",
    rowUpdateMode: "full",
    syncBatchSize: 100,
  }),
})

// function startTodoRefetchInterval() {
//   setInterval(async () => {
//     try {
//       // Refetch data from server (and store into Dexie if fetch() is defined)
//       const data = await todoCollection.utils.refresh();

//       // ✅ Print the data returned by the server
//       console.log("🔁 Refetched todos from server:", data);

//       // ✅ (Optional) Check what’s stored locally in Dexie after refetch
//       const localData = await todoCollection.utils.getTable().toArray();
//       console.log("💾 Local Dexie data after refetch:", localData);

//     } catch (err) {
//       console.error("❌ Failed to refetch todos:", err);
//     }
//   }, 1_000); // every 30 seconds
// }

// startTodoRefetchInterval();

// Batch sync function for efficient syncing
export async function batchSyncTodos(mutations: Array<{
  type: "insert" | "update" | "delete";
  todo: TodoInterface;
}>) {
  const operations = mutations.map(mutation => ({
    type: mutation.type === "insert" ? "CREATE" 
        : mutation.type === "update" ? "UPDATE" 
        : "DELETE",
    todo: {
      ...mutation.todo,
      createdAt: mutation.todo.createdAt instanceof Date 
        ? mutation.todo.createdAt.toISOString() 
        : mutation.todo.createdAt,
      updatedAt: mutation.todo.updatedAt instanceof Date 
        ? mutation.todo.updatedAt.toISOString() 
        : mutation.todo.updatedAt,
    }
  }))

  const response = await fetch(`${API_URL}/sync`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json"
    },

    body: JSON.stringify({ operations }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Batch sync failed: ${error}`)
  }

  return response.json()
}

// Individual sync function (for backwards compatibility)
export async function syncTodo(mutation: {
  type: "insert" | "update" | "delete";
  todo: TodoInterface;
}) {
  return batchSyncTodos([mutation])
}

// Helper to get all unsynced todos
export async function getUnsyncedTodos(): Promise<TodoInterface[]> {
    // Access the raw Dexie table
  const table = todoCollection.utils.getTable();
  const allTodos = (await table.toArray()) as unknown as TodoType[];
  return allTodos.filter((todo: TodoInterface) => !todo.synced)
}

// Helper to mark todo as synced
export async function markAsSynced(todoId: string) {
  await todoCollection.update(todoId, (draft) => {
    draft.synced = true
  })
}

// Helper to get todo statistics
export async function getTodoStats() {
  // Access the raw Dexie table
  const table = todoCollection.utils.getTable();
  const allTodos = (await table.toArray()) as unknown as TodoType[];
  const activeTodos = allTodos.filter((t: TodoInterface) => !t.completed && !t.deleted)
  const completedTodos = allTodos.filter((t: TodoInterface) => t.completed && !t.deleted)
  const unsyncedTodos = allTodos.filter((t: TodoInterface) => !t.synced)
  
  return {
    total: allTodos.length,
    active: activeTodos.length,
    completed: completedTodos.length,
    unsynced: unsyncedTodos.length,
    deleted: allTodos.filter((t: TodoInterface) => t.deleted).length
  }
}