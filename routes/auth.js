const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendResetEmail } = require('../services/email');


function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'username, email, and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address.' });

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        // Read default_credits from system_settings (admin-controlled)
        const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'default_credits'").get();
        const defaultCredits = setting ? parseInt(setting.value) || 4 : 4;
        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash, credits) VALUES (?, ?, ?, ?)'
        ).run(username.trim(), email.toLowerCase().trim(), passwordHash, defaultCredits);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ message: 'Account created.', token: generateToken(user), user: safeUser(user) });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            const field = err.message.includes('email') ? 'email' : 'username';
            return res.status(409).json({ error: `That ${field} is already taken.` });
        }
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Admins must use the secure Admin Portal to log in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

        res.json({ message: 'Login successful.', token: generateToken(user), user: safeUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// POST /api/auth/admin-login
router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (!user) return res.status(401).json({ error: 'Invalid admin credentials.' });

        // Explicitly block normal users
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. You do not have admin privileges.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid admin credentials.' });

        res.json({ message: 'Admin login successful.', token: generateToken(user), user: safeUser(user) });
    } catch (err) {
        console.error('Admin Login error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required.' });

    // Always return success to not reveal whether email exists
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    const SUCCESS_MSG = { message: 'If that email exists, a reset link has been sent.' };

    if (!user) return res.json(SUCCESS_MSG);

    try {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        // Invalidate old tokens for this user
        db.prepare('DELETE FROM reset_tokens WHERE user_id = ?').run(user.id);
        db.prepare('INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);

        await sendResetEmail(user.email, token, user.username);
        res.json(SUCCESS_MSG);
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const record = db.prepare(
        "SELECT * FROM reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
    ).get(token);

    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, record.user_id);
        db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ?').run(record.id);
        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// GET /api/auth/announcement — public: get current announcement banner
router.get('/announcement', (req, res) => {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'announcement'").get();
    res.json({ announcement: row?.value || '' });
});

function safeUser(user) {
    return { id: user.id, username: user.username, email: user.email, credits: user.credits, role: user.role, avatar_color: user.avatar_color, bio: user.bio };
}

module.exports = router;
