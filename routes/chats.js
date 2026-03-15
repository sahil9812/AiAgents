const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// All routes require auth
router.use(authMiddleware);

// GET /api/chats — list user's conversations (newest first)
router.get('/', (req, res) => {
    const conversations = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 50
  `).all(req.user.id);
    res.json({ conversations });
});

// GET /api/chats/search?q= — search conversations by title or message content
router.get('/search', (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ conversations: [] });
    const like = `%${q}%`;
    const conversations = db.prepare(`
        SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.user_id = ?
        AND (c.title LIKE ? OR m.content LIKE ?)
        ORDER BY c.updated_at DESC
        LIMIT 30
    `).all(req.user.id, like, like);
    res.json({ conversations });
});

// POST /api/chats — create new conversation
router.post('/', (req, res) => {
    const { title = 'New Chat' } = req.body;
    const result = db.prepare(
        'INSERT INTO conversations (user_id, title) VALUES (?, ?)'
    ).run(req.user.id, title.slice(0, 80));
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ conversation: conv });
});

// GET /api/chats/:id — get conversation with all messages
router.get('/:id', (req, res) => {
    const conv = db.prepare(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

    const messages = db.prepare(
        'SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conv.id);

    res.json({ conversation: conv, messages });
});

// PATCH /api/chats/:id — rename conversation
router.patch('/:id', (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required.' });

    const conv = db.prepare(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

    db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(title.slice(0, 80), conv.id);

    res.json({ message: 'Renamed.' });
});

// DELETE /api/chats/:id — delete conversation + messages
router.delete('/:id', (req, res) => {
    const conv = db.prepare(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

    db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
    res.json({ message: 'Deleted.' });
});

module.exports = router;
