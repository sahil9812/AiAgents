const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/user/me
router.get('/me', (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, credits, role, avatar_color, bio, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

// PATCH /api/user/profile — update username, bio, avatar_color
router.patch('/profile', (req, res) => {
  const { username, bio, avatar_color } = req.body;

  if (username && username.trim().length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters.' });

  try {
    if (username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), req.user.id);
    if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio.slice(0, 200), req.user.id);
    if (avatar_color) db.prepare('UPDATE users SET avatar_color = ? WHERE id = ?').run(avatar_color, req.user.id);

    const user = db.prepare('SELECT id, username, email, credits, role, avatar_color, bio FROM users WHERE id = ?').get(req.user.id);
    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'That username is already taken.' });
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/user/password — change password
router.patch('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect.' });

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password changed successfully.' });
});

// GET /api/user/usage — daily credit usage for last 30 days
router.get('/usage', (req, res) => {
  const daily = db.prepare(`
    SELECT
      DATE(created_at) as date,
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as used,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as added
    FROM credit_history
    WHERE user_id = ? AND created_at >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all(req.user.id);

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_used,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_added,
      COUNT(*) as total_transactions
    FROM credit_history WHERE user_id = ?
  `).get(req.user.id);

  const recent = db.prepare(`
    SELECT amount, reason, balance_after, created_at
    FROM credit_history WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);

  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);

  res.json({ daily, totals, recent, currentCredits: user.credits });
});

module.exports = router;
