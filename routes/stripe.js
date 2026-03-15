const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Lazy Stripe init so server starts without STRIPE_SECRET_KEY configured
function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your')) {
        throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.');
    }
    return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const CREDIT_PACKAGES = [
    { id: 'starter', name: 'Starter', credits: 50, price: 500, priceId: process.env.STRIPE_PRICE_50 },
    { id: 'pro', name: 'Pro', credits: 200, price: 1500, priceId: process.env.STRIPE_PRICE_200 },
    { id: 'unlimited', name: 'Unlimited', credits: 1000, price: 4900, priceId: process.env.STRIPE_PRICE_1000 },
];

// GET /api/stripe/packages — list credit packages
router.get('/packages', (req, res) => {
    res.json({ packages: CREDIT_PACKAGES.map(({ id, name, credits, price }) => ({ id, name, credits, price })) });
});

// POST /api/stripe/create-checkout — create Stripe checkout session
router.post('/create-checkout', authMiddleware, async (req, res) => {
    const { packageId } = req.body;
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: 'Invalid package.' });
    if (!pkg.priceId) return res.status(500).json({ error: 'Stripe price not configured for this package.' });

    try {
        const stripe = getStripe();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        // Get or create Stripe customer
        let customerId = user.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({ email: user.email, name: user.username });
            customerId = customer.id;
            db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{ price: pkg.priceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${process.env.APP_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/upgrade`,
            metadata: { userId: String(user.id), credits: String(pkg.credits), packageId: pkg.id },
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Stripe error:', err.message);
        res.status(500).json({ error: err.message.includes('not configured') ? err.message : 'Payment service error.' });
    }
});

// POST /api/stripe/webhook — Stripe sends payment events here
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = parseInt(session.metadata.userId);
        const credits = parseInt(session.metadata.credits);

        const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
        if (user) {
            const newBalance = user.credits + credits;
            db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newBalance, userId);
            db.prepare('INSERT INTO credit_history (user_id, amount, reason, balance_after) VALUES (?, ?, ?, ?)')
                .run(userId, credits, `stripe_${session.metadata.packageId}`, newBalance);
        }
    }

    res.json({ received: true });
});

module.exports = router;
