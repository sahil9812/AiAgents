const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Check if user is suspended
        const user = db.prepare('SELECT suspended FROM users WHERE id = ?').get(decoded.id);
        if (!user) return res.status(401).json({ error: 'User not found.' });
        if (user.suspended) return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
        req.user = decoded; // { id, username, email }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};
