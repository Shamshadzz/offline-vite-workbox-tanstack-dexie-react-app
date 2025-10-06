const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/offline-todo', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Todo Schema
const TodoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    text: String,
    completed: Boolean,
    userId: String,
    userName: String,
    version: { type: Number, default: 1 },
    createdAt: Date,
    updatedAt: Date,
    synced: Boolean,
    deleted: { type: Boolean, default: false }
});

const Todo = mongoose.model('Todo', TodoSchema);

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend is running' });
});

// Get all todos
app.get('/api/todos', async (req, res) => {
    try {
        const todos = await Todo.find();
        res.json(todos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync todos (batch operation)
app.post('/api/sync', async (req, res) => {
    const { operations } = req.body;
    const results = [];
    const conflicts = [];

    console.log(`📥 Received ${operations.length} operations to sync`);

    for (const op of operations) {
        try {
            if (op.type === 'CREATE') {
                const existing = await Todo.findOne({ id: op.todo.id });
                if (existing) {
                    // Check if it's a real conflict or just a duplicate sync
                    if (existing.version >= op.todo.version) {
                        // Server version is newer or same, no conflict
                        results.push(existing);
                        console.log(`✅ Todo already exists with newer version: ${op.todo.id}`);
                    } else {
                        conflicts.push({
                            op,
                            reason: 'Version conflict - server has newer version',
                            type: 'VERSION_CONFLICT',
                            serverVersion: existing,
                            clientVersion: op.todo
                        });
                        console.log(`⚠️ Version conflict on todo: ${op.todo.id}`);
                    }
                } else {
                    const todo = new Todo(op.todo);
                    await todo.save();
                    results.push(todo);
                    console.log(`✅ Created todo: ${op.todo.id}`);
                }
            } else if (op.type === 'UPDATE') {
                const existing = await Todo.findOne({ id: op.todo.id });
                if (existing && existing.version > op.todo.version) {
                    conflicts.push({
                        op,
                        reason: 'Version conflict - server has newer version',
                        type: 'VERSION_CONFLICT',
                        serverVersion: existing,
                        clientVersion: op.todo
                    });
                    console.log(`⚠️ Version conflict on todo: ${op.todo.id}`);
                } else {
                    await Todo.updateOne(
                        { id: op.todo.id },
                        { $set: { ...op.todo, updatedAt: new Date() } },
                        { upsert: true }
                    );
                    results.push(op.todo);
                    console.log(`✅ Updated todo: ${op.todo.id}`);
                }
            } else if (op.type === 'DELETE') {
                const existing = await Todo.findOne({ id: op.todo.id });
                if (existing) {
                    // Convert delete into a tombstone: mark deleted=true, bump version and updatedAt
                    existing.deleted = true;
                    existing.version = (op.todo.version && op.todo.version > existing.version) ? op.todo.version : (existing.version + 1);
                    existing.updatedAt = new Date();
                    await existing.save();
                    results.push(existing);
                } else {
                    // Create a tombstone if the record doesn't exist so clients can reconcile
                    const tombstone = new Todo({
                        ...op.todo,
                        deleted: true,
                        createdAt: op.todo.createdAt ? new Date(op.todo.createdAt) : new Date(),
                        updatedAt: new Date(),
                        version: op.todo.version || 1
                    });
                    await tombstone.save();
                    results.push(tombstone);
                }
                console.log(`✅ Marked todo deleted (tombstone): ${op.todo.id}`);
            }
        } catch (error) {
            conflicts.push({
                op,
                reason: error.message,
                type: 'ERROR'
            });
            console.error(`❌ Error processing operation:`, error);
        }
    }

    console.log(`📤 Sync complete: ${results.length} success, ${conflicts.length} conflicts`);
    res.json({
        success: true,
        results,
        conflicts,
        synced: results.length,
        conflictCount: conflicts.length
    });
});

// Clear all todos (for testing)
app.delete('/api/todos', async (req, res) => {
    try {
        await Todo.deleteMany({});
        res.json({ message: 'All todos deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 API endpoints:
  - GET  http://localhost:${PORT}/api/health
  - GET  http://localhost:${PORT}/api/todos
  - POST http://localhost:${PORT}/api/sync
  - DELETE http://localhost:${PORT}/api/todos
  `);
});