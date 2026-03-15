import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';

// ── Forgot Password ────────────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault(); setLoading(true); setError(''); setMsg('');
        try {
            const res = await api.post('/auth/forgot-password', { email });
            setMsg(res.data.message);
        } catch (e) { setError(e.response?.data?.error || 'Something went wrong.'); }
        finally { setLoading(false); }
    }

    return (
        <div className="auth-card">
            <div className="auth-logo"><div className="auth-logo-icon">🔑</div><span className="auth-logo-text">Nickxor</span></div>
            <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>Forgot Password</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Enter your email and we'll send a reset link.</p>
            {msg ? (
                <div className="form-success">{msg}</div>
            ) : (
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
                    </div>
                    {error && <div className="form-error">⚠️ {error}</div>}
                    <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Sending…' : '📧 Send Reset Link'}</button>
                </form>
            )}
            <button onClick={onBack} style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px' }}>← Back to Login</button>
        </div>
    );
}

// ── Reset Password ─────────────────────────────────────────────────────────────
function ResetPasswordView({ token }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({ password: '', confirm: '' });
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.password !== form.confirm) return setError('Passwords do not match.');
        setLoading(true); setError('');
        try {
            const res = await api.post('/auth/reset-password', { token, password: form.password });
            setMsg(res.data.message);
            setTimeout(() => navigate('/auth'), 2500);
        } catch (e) { setError(e.response?.data?.error || 'Invalid or expired link.'); }
        finally { setLoading(false); }
    }

    return (
        <div className="auth-card">
            <div className="auth-logo"><div className="auth-logo-icon">🔒</div><span className="auth-logo-text">Nickxor</span></div>
            <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>Set New Password</h3>
            {msg ? <div className="form-success">{msg}<br /><small>Redirecting to login…</small></div> : (
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input className="form-input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} placeholder="Min 6 characters" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input className="form-input" type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required placeholder="Repeat password" />
                    </div>
                    {error && <div className="form-error">⚠️ {error}</div>}
                    <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Saving…' : '🔒 Reset Password'}</button>
                </form>
            )}
        </div>
    );
}

// ── Main Auth Page ─────────────────────────────────────────────────────────────
export default function AuthPage() {
    const [searchParams] = useSearchParams();
    const resetToken = searchParams.get('token');

    const [tab, setTab] = useState('login');
    const [view, setView] = useState('auth'); // 'auth' | 'forgot'
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Show reset view if token present
    if (resetToken) return (
        <div className="auth-page">
            <div className="auth-bg-orb auth-bg-orb-1" /><div className="auth-bg-orb auth-bg-orb-2" />
            <ResetPasswordView token={resetToken} />
        </div>
    );

    if (view === 'forgot') return (
        <div className="auth-page">
            <div className="auth-bg-orb auth-bg-orb-1" /><div className="auth-bg-orb auth-bg-orb-2" />
            <ForgotPasswordView onBack={() => setView('auth')} />
        </div>
    );

    function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
            const payload = tab === 'login'
                ? { email: form.email, password: form.password }
                : { username: form.username, email: form.email, password: form.password };
            const res = await api.post(endpoint, payload);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/chat');
        } catch (err) { setError(err.response?.data?.error || 'Something went wrong. Please try again.'); }
        finally { setLoading(false); }
    }

    function switchTab(t) { setTab(t); setError(''); setForm({ username: '', email: '', password: '' }); }

    return (
        <div className="auth-page">
            <div className="auth-bg-orb auth-bg-orb-1" /><div className="auth-bg-orb auth-bg-orb-2" />
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">🤖</div>
                    <span className="auth-logo-text">Nickxor</span>
                </div>
                <div className="auth-tabs">
                    <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Login</button>
                    <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Register</button>
                </div>
                <form className="auth-form" onSubmit={handleSubmit}>
                    {tab === 'register' && (
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input className="form-input" type="text" name="username" placeholder="johndoe" value={form.username} onChange={handleChange} required autoComplete="username" />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input className="form-input" type="password" name="password" placeholder={tab === 'register' ? 'Min 6 characters' : 'Your password'} value={form.password} onChange={handleChange} required autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
                    </div>
                    {error && <div className="form-error">⚠️ {error}</div>}
                    <button className="btn-primary" type="submit" disabled={loading}>
                        {loading ? '⏳ Please wait…' : tab === 'login' ? '🚀 Login' : '✨ Create Account'}
                    </button>
                </form>
                {tab === 'login' && (
                    <button onClick={() => setView('forgot')} style={{ marginTop: '12px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
                        Forgot password?
                    </button>
                )}
                {tab === 'register' && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center', lineHeight: 1.6 }}>
                        New accounts receive <strong style={{ color: 'var(--accent)' }}>20 free credits</strong> to get started.
                    </p>
                )}
            </div>
        </div>
    );
}
