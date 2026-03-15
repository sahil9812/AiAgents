import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/user/usage').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="page-layout"><div className="page-loading">Loading…</div></div>;
    if (!data) return <div className="page-layout"><div className="form-error" style={{ margin: '16px' }}>Failed to load usage data.</div></div>;

    const { daily, totals, recent, currentCredits } = data;
    const maxUsed = Math.max(...daily.map(d => d.used), 1);

    // Fill last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const found = daily.find(x => x.date === key);
        days.push({ date: key, used: found?.used || 0, added: found?.added || 0 });
    }

    return (
        <div className="page-layout">
            <div className="page-header">
                <Link to="/chat" className="back-btn">← Back to Chat</Link>
                <h1 className="page-title">📊 Usage Dashboard</h1>
            </div>

            {/* Summary cards */}
            <div className="stat-cards">
                {[
                    { label: 'Credits Left', value: currentCredits, icon: '⚡', accent: true },
                    { label: 'Total Used', value: totals.total_used, icon: '📉' },
                    { label: 'Total Added', value: totals.total_added, icon: '📈' },
                    { label: 'Transactions', value: totals.total_transactions, icon: '🔄' },
                ].map(s => (
                    <div key={s.label} className={`stat-card ${s.accent ? 'accent' : ''}`}>
                        <div className="stat-icon">{s.icon}</div>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Bar chart */}
            <div className="chart-card">
                <div className="chart-title">Credits Used — Last 30 Days</div>
                <div className="bar-chart">
                    {days.map(day => (
                        <div key={day.date} className="bar-col" title={`${day.date}: ${day.used} used`}>
                            <div
                                className="bar-fill"
                                style={{ height: `${(day.used / maxUsed) * 100}%` }}
                            />
                            <div className="bar-label">{day.date.slice(8)}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent transactions */}
            <div className="chart-card">
                <div className="chart-title">Recent Transactions</div>
                {recent.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>No transactions yet.</div>
                ) : (
                    <div className="tx-list">
                        {recent.map((tx, i) => (
                            <div key={i} className="tx-row">
                                <span className={`tx-amount ${tx.amount < 0 ? 'neg' : 'pos'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                                </span>
                                <span className="tx-reason">{tx.reason.replace(/_/g, ' ')}</span>
                                <span className="tx-balance">→ {tx.balance_after} left</span>
                                <span className="tx-date">{new Date(tx.created_at).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
