import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

const AVATAR_COLORS = ['#4f8ef7', '#a78bfa', '#34d399', '#f59e0b', '#f87171', '#38bdf8', '#fb7185'];

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({ username: '', bio: '', avatar_color: '' });
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [msg, setMsg] = useState('');
    const [pwMsg, setPwMsg] = useState('');
    const [error, setError] = useState('');
    const [pwError, setPwError] = useState('');
    const [saving, setSaving] = useState(false);
    const [savingPw, setSavingPw] = useState(false);

    useEffect(() => {
        api.get('/user/me').then(r => {
            setProfile(r.data.user);
            setForm({ username: r.data.user.username, bio: r.data.user.bio || '', avatar_color: r.data.user.avatar_color || '#4f8ef7' });
        });
    }, []);

    async function saveProfile(e) {
        e.preventDefault();
        setSaving(true); setMsg(''); setError('');
        try {
            const res = await api.patch('/user/profile', form);
            setProfile(res.data.user);
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...stored, ...res.data.user }));
            setMsg('✅ Profile updated!');
        } catch (e) { setError(e.response?.data?.error || 'Failed to save.'); }
        finally { setSaving(false); }
    }

    async function changePassword(e) {
        e.preventDefault();
        if (pwForm.newPassword !== pwForm.confirmPassword) return setPwError('Passwords do not match.');
        setSavingPw(true); setPwMsg(''); setPwError('');
        try {
            await api.patch('/user/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
            setPwMsg('✅ Password changed!');
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e) { setPwError(e.response?.data?.error || 'Failed to change password.'); }
        finally { setSavingPw(false); }
    }

    if (!profile) return <div className="page-layout"><div className="page-loading">Loading…</div></div>;

    return (
        <div className="page-layout">
            <div className="page-header">
                <Link to="/chat" className="back-btn">← Back to Chat</Link>
                <h1 className="page-title">👤 My Profile</h1>
            </div>

            <div className="profile-grid">
                {/* Profile info */}
                <div className="pro-card">
                    <div className="pro-avatar-big" style={{ background: form.avatar_color }}>
                        {form.username[0]?.toUpperCase()}
                    </div>
                    <div className="pro-meta">
                        <div className="pro-name">{profile.username}</div>
                        <div className="pro-email">{profile.email}</div>
                        <div className="pro-role-badge">{profile.role}</div>
                        <div className="pro-joined">Member since {new Date(profile.created_at).toLocaleDateString()}</div>
                        <div className="pro-credits">⚡ {profile.credits} credits</div>
                    </div>
                </div>

                {/* Edit form */}
                <div className="settings-card">
                    <h3 className="settings-title">Edit Profile</h3>
                    <form onSubmit={saveProfile} className="settings-form">
                        <label className="form-label">Username</label>
                        <input className="form-input" value={form.username}
                            onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />

                        <label className="form-label">Bio</label>
                        <textarea className="form-input form-textarea" rows={3} maxLength={200}
                            placeholder="Tell something about yourself…" value={form.bio}
                            onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />

                        <label className="form-label">Avatar Color</label>
                        <div className="color-picker">
                            {AVATAR_COLORS.map(c => (
                                <button key={c} type="button"
                                    className={`color-swatch ${form.avatar_color === c ? 'selected' : ''}`}
                                    style={{ background: c }}
                                    onClick={() => setForm(p => ({ ...p, avatar_color: c }))}
                                />
                            ))}
                        </div>

                        {msg && <div className="form-success">{msg}</div>}
                        {error && <div className="form-error">{error}</div>}
                        <button className="btn-primary" type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save Profile'}
                        </button>
                    </form>
                </div>

                {/* Change password */}
                <div className="settings-card">
                    <h3 className="settings-title">Change Password</h3>
                    <form onSubmit={changePassword} className="settings-form">
                        {[
                            { key: 'currentPassword', label: 'Current Password' },
                            { key: 'newPassword', label: 'New Password' },
                            { key: 'confirmPassword', label: 'Confirm New Password' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="form-label">{f.label}</label>
                                <input className="form-input" type="password"
                                    value={pwForm[f.key]}
                                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))} />
                            </div>
                        ))}
                        {pwMsg && <div className="form-success">{pwMsg}</div>}
                        {pwError && <div className="form-error">{pwError}</div>}
                        <button className="btn-primary" type="submit" disabled={savingPw}>
                            {savingPw ? 'Changing…' : 'Change Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
