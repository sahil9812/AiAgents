require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
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

app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Rate limiters
const globalLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 1000, // Increased from 300
    message: { error: 'Too many requests. Please try again in 15 minutes.' },
    keyGenerator: (req) => req.ip // Explicitly use req.ip
});

const authLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 100, // Increased from 20
    message: { error: 'Too many auth attempts. Please try again later.' },
    keyGenerator: (req) => req.ip
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
app.use(express.static(frontendPath));

// Handle SPA routing: any request that doesn't match an API route or static file should serve index.html
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
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
