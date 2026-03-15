const db = require('../db');

module.exports = function creditsMiddleware(req, res, next) {
    if (req.user?.role === 'admin') {
        req.userCredits = 'Unlimited';
        return next();
    }

    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);

    if (!user || user.credits <= 0) {
        return res.status(402).json({
            error: 'You have run out of credits. Please upgrade your plan to continue.'
        });
    }

    req.userCredits = user.credits;
    next();
};
