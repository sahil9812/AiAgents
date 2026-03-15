import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

export default function AdminPage() {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [settings, setSettings] = useState({ default_credits: '4', announcement: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [creditInputs, setCreditInputs] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [settingsSaved, setSettingsSaved] = useState('');
    const searchDebounce = useRef(null);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        try {
            const [usersRes, statsRes, settingsRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/stats'),
                api.get('/admin/settings'),
            ]);
            setUsers(usersRes.data.users);
            setStats(statsRes.data);
            setSettings(settingsRes.data.settings);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to load admin data.');
        } finally { setLoading(false); }
    }

    // ── User search ──────────────────────────────────────────────────────────
    function handleSearch(e) {
        const q = e.target.value;
        setSearchQuery(q);
        clearTimeout(searchDebounce.current);
        if (!q.trim()) { fetchData(); return; }
        searchDebounce.current = setTimeout(async () => {
            try {
                const res = await api.get(`/admin/users/search?q=${encodeURIComponent(q)}`);
                setUsers(res.data.users);
            } catch { }
        }, 300);
    }

    // ── Credit adjustment ────────────────────────────────────────────────────
    async function adjustCredits(userId, amount) {
        if (!amount || isNaN(amount)) return;
        try {
            const res = await api.patch(`/admin/users/${userId}/credits`, { amount: parseInt(amount) });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: res.data.credits } : u));
            setCreditInputs(prev => ({ ...prev, [userId]: '' }));
        } catch (e) { alert(e.response?.data?.error || 'Failed to update credits.'); }
    }

    // ── Role toggle ──────────────────────────────────────────────────────────
    async function toggleRole(user) {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        if (!confirm(`Change ${user.username}'s role to ${newRole}?`)) return;
        try {
            await api.patch(`/admin/users/${user.id}/role`, { role: newRole });
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        } catch (e) { alert(e.response?.data?.error || 'Failed to update role.'); }
    }

    // ── Suspend toggle ───────────────────────────────────────────────────────
    async function toggleSuspend(user) {
        const action = user.suspended ? 'Unsuspend' : 'Suspend';
        if (!confirm(`${action} ${user.username}?`)) return;
        try {
            const res = await api.patch(`/admin/users/${user.id}/suspend`);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, suspended: res.data.suspended } : u));
        } catch (e) { alert(e.response?.data?.error || 'Failed.'); }
    }

    // ── Delete user ──────────────────────────────────────────────────────────
    async function deleteUser(user) {
        if (!confirm(`Delete ${user.username}? This cannot be undone.`)) return;
        try {
            await api.delete(`/admin/users/${user.id}`);
            setUsers(prev => prev.filter(u => u.id !== user.id));
        } catch (e) { alert(e.response?.data?.error || 'Failed to delete user.'); }
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    async function saveSetting(key, value) {
        try {
            await api.patch('/admin/settings', { key, value });
            setSettings(prev => ({ ...prev, [key]: value }));
            setSettingsSaved(key);
            setTimeout(() => setSettingsSaved(''), 2000);
        } catch (e) { alert(e.response?.data?.error || 'Failed to save setting.'); }
    }

    // ── Chart helpers ────────────────────────────────────────────────────────
    function buildChart(data, days = 30) {
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const found = data.find(x => x.date === key);
            result.push({ date: key, count: found?.count || 0 });
        }
        return result;
    }

    if (loading) return <div className="page-layout"><div className="page-loading">Loading…</div></div>;
    if (error) return <div className="page-layout"><div className="form-error" style={{ margin: 16 }}>{error}</div></div>;

    const newUsersData = stats ? buildChart(stats.newUsersChart) : [];
    const messagesData = stats ? buildChart(stats.messagesChart) : [];
    const maxNew = Math.max(...newUsersData.map(d => d.count), 1);
    const maxMsg = Math.max(...messagesData.map(d => d.count), 1);

    return (
        <div className="page-layout">
            <div className="page-header">
                <Link to="/chat" className="back-btn">← Back to Chat</Link>
                <h1 className="page-title">🛡️ Admin Panel</h1>
            </div>

            {/* ── Stats ── */}
            {stats && (
                <div className="stat-cards">
                    {[
                        { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
                        { label: 'New Today', value: stats.newUsersToday, icon: '🆕', accent: true },
                        { label: 'Total Chats', value: stats.totalChats, icon: '💬' },
                        { label: 'Total Messages', value: stats.totalMessages, icon: '📨' },
                        { label: 'Credits Used', value: stats.creditsUsed, icon: '⚡' },
                        { label: 'Suspended', value: stats.suspendedUsers, icon: '🚫' },
                    ].map(s => (
                        <div key={s.label} className={`stat-card ${s.accent ? 'accent' : ''}`}>
                            <div className="stat-icon">{s.icon}</div>
                            <div className="stat-value">{s.value?.toLocaleString()}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Charts ── */}
            <div className="admin-charts-row">
                <div className="chart-card">
                    <div className="chart-title">📈 New Users — Last 30 Days</div>
                    <div className="bar-chart">
                        {newUsersData.map(day => (
                            <div key={day.date} className="bar-col" title={`${day.date}: ${day.count} new users`}>
                                <div className="bar-fill" style={{ height: `${(day.count / maxNew) * 100}%`, background: 'var(--green)' }} />
                                <div className="bar-label">{day.date.slice(8)}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="chart-card">
                    <div className="chart-title">💬 Messages Sent — Last 30 Days</div>
                    <div className="bar-chart">
                        {messagesData.map(day => (
                            <div key={day.date} className="bar-col" title={`${day.date}: ${day.count} messages`}>
                                <div className="bar-fill" style={{ height: `${(day.count / maxMsg) * 100}%` }} />
                                <div className="bar-label">{day.date.slice(8)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── System Controls ── */}
            <div className="admin-controls-row">
                {/* Default Credits */}
                <div className="chart-card admin-control-card">
                    <div className="chart-title">⚙️ Default Credits for New Users</div>
                    <p className="admin-control-desc">How many free credits new signups receive.</p>
                    <div className="admin-control-row">
                        <input
                            type="number"
                            min="0"
                            max="9999"
                            className="admin-control-input"
                            value={settings.default_credits}
                            onChange={e => setSettings(p => ({ ...p, default_credits: e.target.value }))}
                        />
                        <button
                            className="btn-admin-save"
                            onClick={() => saveSetting('default_credits', settings.default_credits)}
                        >
                            {settingsSaved === 'default_credits' ? '✅ Saved!' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* Broadcast Announcement */}
                <div className="chart-card admin-control-card">
                    <div className="chart-title">📢 Broadcast Announcement</div>
                    <p className="admin-control-desc">Show a banner to all users in the chat. Leave empty to hide.</p>
                    <textarea
                        className="admin-announce-input"
                        placeholder="Type announcement message…"
                        value={settings.announcement}
                        onChange={e => setSettings(p => ({ ...p, announcement: e.target.value }))}
                        rows={3}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                            className="btn-admin-save"
                            onClick={() => saveSetting('announcement', settings.announcement)}
                        >
                            {settingsSaved === 'announcement' ? '✅ Sent!' : '📢 Broadcast'}
                        </button>
                        {settings.announcement && (
                            <button
                                className="btn-admin-clear"
                                onClick={() => { setSettings(p => ({ ...p, announcement: '' })); saveSetting('announcement', ''); }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Users Table ── */}
            <div className="admin-table-wrapper">
                <div className="admin-table-header">
                    <div className="chart-title" style={{ margin: 0 }}>👥 Users ({users.length})</div>
                    <div className="admin-search-wrap">
                        <span>🔍</span>
                        <input
                            type="text"
                            className="admin-search-input"
                            placeholder="Search by name or email…"
                            value={searchQuery}
                            onChange={handleSearch}
                        />
                        {searchQuery && (
                            <button className="sidebar-search-clear" onClick={() => { setSearchQuery(''); fetchData(); }}>✕</button>
                        )}
                    </div>
                </div>

                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Credits</th>
                            <th>Adjust</th>
                            <th>Messages</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className={user.suspended ? 'suspended-row' : ''}>
                                <td>
                                    <div className="admin-user-cell">
                                        <div className="mini-avatar" style={{ background: user.suspended ? '#64748b' : user.avatar_color }}>
                                            {user.username[0].toUpperCase()}
                                        </div>
                                        <span>{user.username}</span>
                                    </div>
                                </td>
                                <td className="td-muted">{user.email}</td>
                                <td><span className="credit-pill">{user.credits}</span></td>
                                <td>
                                    <div className="credit-adjust">
                                        <input
                                            type="number"
                                            placeholder="±"
                                            value={creditInputs[user.id] || ''}
                                            onChange={e => setCreditInputs(p => ({ ...p, [user.id]: e.target.value }))}
                                            className="credit-input"
                                        />
                                        <button className="btn-adjust" onClick={() => adjustCredits(user.id, creditInputs[user.id])}>Apply</button>
                                    </div>
                                </td>
                                <td className="td-muted">{user.total_messages ?? 0}</td>
                                <td>
                                    <button className={`role-badge ${user.role}`} onClick={() => toggleRole(user)} title="Click to toggle role">
                                        {user.role}
                                    </button>
                                </td>
                                <td className="td-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button
                                        className={`btn-suspend ${user.suspended ? 'unsuspend' : ''}`}
                                        onClick={() => toggleSuspend(user)}
                                        title={user.suspended ? 'Unsuspend user' : 'Suspend user'}
                                    >
                                        {user.suspended ? '✅ Unsuspend' : '🚫 Suspend'}
                                    </button>
                                </td>
                                <td>
                                    <button className="btn-delete-user" onClick={() => deleteUser(user)} title="Delete user">🗑</button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={9} className="td-muted" style={{ textAlign: 'center', padding: 24 }}>No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
