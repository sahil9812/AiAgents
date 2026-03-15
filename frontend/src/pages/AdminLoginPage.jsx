import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

export default function AdminLoginPage() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/admin-login', form);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/admin');
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page" style={{ background: 'var(--bg-secondary)' }}>
            <div className="auth-card" style={{ borderColor: 'var(--purple)', boxShadow: '0 8px 32px rgba(124, 58, 237, 0.15)' }}>
                <div className="auth-logo" style={{ marginBottom: '24px' }}>
                    <div className="auth-logo-icon" style={{ background: 'var(--purple)' }}>🛡️</div>
                    <span className="auth-logo-text" style={{ color: 'var(--purple)' }}>Admin Portal</span>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Admin Email</label>
                        <input
                            className="form-input"
                            type="email"
                            name="email"
                            placeholder="admin@example.com"
                            value={form.email}
                            onChange={handleChange}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input"
                            type="password"
                            name="password"
                            placeholder="Admin password"
                            value={form.password}
                            onChange={handleChange}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    {error && <div className="form-error">⚠️ {error}</div>}

                    <button
                        className="btn-primary"
                        type="submit"
                        disabled={loading}
                        style={{ background: 'var(--purple)', marginTop: '8px' }}
                    >
                        {loading ? '⏳ Authenticating…' : '🛡️ Secure Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
