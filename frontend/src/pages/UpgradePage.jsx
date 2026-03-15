import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/api';

const PACKAGES = [
    { id: 'starter', name: 'Starter', credits: 50, price: '$5', desc: 'Perfect for testing', popular: false },
    { id: 'pro', name: 'Pro', credits: 200, price: '$15', desc: 'Best for regular usage', popular: true },
    { id: 'unlimited', name: 'Unlimited', credits: 1000, price: '$49', desc: 'Power users & teams', popular: false },
];

function SuccessView() {
    return (
        <div className="page-layout" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '20px' }}>
            <div style={{ fontSize: '64px' }}>🎉</div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, background: 'var(--gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Payment Successful!
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Your credits have been added to your account.</p>
            <Link to="/chat" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 28px', borderRadius: '10px' }}>
                Start Chatting ✨
            </Link>
        </div>
    );
}

export default function UpgradePage() {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    if (searchParams.get('session_id')) return <SuccessView />;

    async function handleUpgrade(pkgId) {
        setLoading(pkgId); setError('');
        try {
            const res = await api.post('/stripe/create-checkout', { packageId: pkgId });
            window.location.href = res.data.url;
        } catch (e) {
            setError(e.response?.data?.error || 'Payment service unavailable. Please add Stripe keys to .env');
            setLoading(null);
        }
    }

    return (
        <div className="page-layout">
            <div className="page-header">
                <Link to="/chat" className="back-btn">← Back to Chat</Link>
                <h1 className="page-title">⚡ Upgrade Credits</h1>
            </div>
            <p className="page-subtitle">Choose a credit package to continue using Nickxor.</p>

            {error && <div className="form-error" style={{ margin: '0 24px' }}>{error}</div>}

            <div className="pricing-grid">
                {PACKAGES.map(pkg => (
                    <div key={pkg.id} className={`pricing-card ${pkg.popular ? 'popular' : ''}`}>
                        {pkg.popular && <div className="popular-badge">⭐ Most Popular</div>}
                        <div className="pricing-name">{pkg.name}</div>
                        <div className="pricing-price">{pkg.price}</div>
                        <div className="pricing-credits">⚡ {pkg.credits.toLocaleString()} Credits</div>
                        <div className="pricing-desc">{pkg.desc}</div>
                        <button
                            className="btn-primary"
                            onClick={() => handleUpgrade(pkg.id)}
                            disabled={!!loading}
                            style={{ width: '100%', marginTop: 'auto' }}
                        >
                            {loading === pkg.id ? 'Redirecting…' : `Get ${pkg.name}`}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
