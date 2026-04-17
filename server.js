require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agent');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chats');
const adminRoutes = require('./routes/admin');
const stripeRoutes = require('./routes/stripe');
const projectRoutes = require('./routes/projects');
const projectFilesRoutes = require('./routes/projectFiles');

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
    console.error('❌ CRITICAL ERROR: JWT_SECRET is not defined in .env or environment variables.');
    console.error('Production deployment will fail during authentication.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
}

const app = express();

// Trust proxy for Railway/PaaS to get real user IPs for rate limiting
app.set('trust proxy', 1);

// Stripe webhook needs raw body — mount BEFORE express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman, Railway health checks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Rate limiters
const globalLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 1000, // Increased from 300
    message: { error: 'Too many requests. Please try again in 15 minutes.' }
});

const authLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 100, // Increased from 20
    message: { error: 'Too many auth attempts. Please try again later.' }
});

app.use(globalLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/webcreator', require('./routes/webcreator'));
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/files', projectFilesRoutes);

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Serve static assets in production
const frontendPath = path.join(__dirname, 'frontend', 'dist');
console.log(`[Static] Serving frontend from: ${frontendPath}`);
console.log(`[Static] index.html exists: ${fs.existsSync(path.join(frontendPath, 'index.html'))}`);
app.use(express.static(frontendPath));

// SPA fallback — serve index.html for all non-API, non-asset routes
app.use((req, res, next) => {
    // Pass API routes through to the 404 handler
    if (req.path.startsWith('/api')) return next();

    // Pass asset requests (missing .js/.css etc) through to the 404 handler
    if (path.extname(req.path)) return next();

    const indexPath = path.join(frontendPath, 'index.html');

    // Check existence synchronously to avoid Express 5 sendFile callback edge cases
    if (!fs.existsSync(indexPath)) {
        console.error('❌ index.html not found at:', indexPath);
        return res.status(503).send(
            '<h2>Frontend not built.</h2><p>Run <code>npm run build</code> to generate the frontend bundle.</p>'
        );
    }

    res.sendFile(indexPath);
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    if (process.env.NODE_ENV === 'production') {
        console.log(`🚀 AI Agent Server is LIVE in production on port ${PORT}`);
    } else {
        console.log(`✅ AI Agent Server running on http://localhost:${PORT}`);
    }
});
