const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.use(authMiddleware, adminMiddleware);

// GET /api/admin/users — list all users with message count
router.get('/users', (req, res) => {
    const users = db.prepare(`
        SELECT u.id, u.username, u.email, u.credits, u.role, u.avatar_color,
               u.suspended, u.created_at,
               (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = u.id AND m.role = 'user') as total_messages
        FROM users u ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
});

// GET /api/admin/users/search?q= — search by username or email
router.get('/users/search', (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });
    const like = `%${q}%`;
    const users = db.prepare(`
        SELECT u.id, u.username, u.email, u.credits, u.role, u.avatar_color,
               u.suspended, u.created_at,
               (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = u.id AND m.role = 'user') as total_messages
        FROM users u
        WHERE u.username LIKE ? OR u.email LIKE ?
        ORDER BY u.created_at DESC LIMIT 50
    `).all(like, like);
    res.json({ users });
});

// PATCH /api/admin/users/:id/credits — adjust credits
router.patch('/users/:id/credits', (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number') return res.status(400).json({ error: 'amount must be a number.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const newCredits = Math.max(0, user.credits + amount);
    db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newCredits, user.id);
    db.prepare('INSERT INTO credit_history (user_id, amount, reason, balance_after) VALUES (?, ?, ?, ?)')
        .run(user.id, amount, 'admin_adjustment', newCredits);
    res.json({ message: 'Credits updated.', credits: newCredits });
});

// PATCH /api/admin/users/:id/role — toggle admin role
router.patch('/users/:id/role', (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be user or admin.' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (String(user.id) === String(req.user.id) && role === 'user') {
        return res.status(400).json({ error: 'You cannot remove your own admin role.' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
    res.json({ message: `Role updated to ${role}.` });
});

// PATCH /api/admin/users/:id/suspend — toggle suspend
router.patch('/users/:id/suspend', (req, res) => {
    if (String(req.params.id) === String(req.user.id)) {
        return res.status(400).json({ error: 'You cannot suspend your own account.' });
    }
    const user = db.prepare('SELECT id, suspended FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const newStatus = user.suspended ? 0 : 1;
    db.prepare('UPDATE users SET suspended = ? WHERE id = ?').run(newStatus, user.id);
    res.json({ message: newStatus ? 'User suspended.' : 'User unsuspended.', suspended: newStatus });
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', (req, res) => {
    if (String(req.params.id) === String(req.user.id)) {
        return res.status(400).json({ error: 'You cannot delete your own account from admin panel.' });
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    res.json({ message: 'User deleted.' });
});

// GET /api/admin/stats — platform overview + charts
router.get('/stats', (req, res) => {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalChats = db.prepare('SELECT COUNT(*) as c FROM conversations').get().c;
    const totalMessages = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const creditsUsed = db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as c FROM credit_history WHERE amount < 0").get().c;
    const revenue = db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as c FROM credit_history WHERE reason LIKE 'stripe_%'").get().c;
    const suspendedUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE suspended = 1').get().c;
    const newUsersToday = db.prepare("SELECT COUNT(*) as c FROM users WHERE DATE(created_at) = DATE('now')").get().c;

    // New users per day — last 30 days
    const newUsersChart = db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= DATE('now', '-29 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `).all();

    // Messages per day — last 30 days
    const messagesChart = db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM messages
        WHERE role = 'user' AND created_at >= DATE('now', '-29 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `).all();

    res.json({ totalUsers, totalChats, totalMessages, creditsUsed, revenue, suspendedUsers, newUsersToday, newUsersChart, messagesChart });
});

// GET /api/admin/settings — get system settings
router.get('/settings', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json({ settings });
});

// PATCH /api/admin/settings — update a system setting
router.patch('/settings', (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value are required.' });
    const allowed = ['default_credits', 'announcement'];
    if (!allowed.includes(key)) return res.status(400).json({ error: 'Invalid setting key.' });
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run(key, String(value));
    res.json({ message: 'Setting updated.', key, value });
});

module.exports = router;
