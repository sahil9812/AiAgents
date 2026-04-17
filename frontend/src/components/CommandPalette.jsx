import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const COMMANDS = [
    { id: 'new-chat',    icon: '✏️',  label: 'New Chat',       desc: 'Start a fresh conversation',      category: 'Actions',    shortcut: 'N' },
    { id: 'nav-chat',    icon: '💬',  label: 'Go to Chat',     desc: 'Open the main chat workspace',     category: 'Navigate',   path: '/chat' },
    { id: 'nav-creator', icon: '🛠️',  label: 'Web Creator',    desc: 'Build websites with AI',           category: 'Navigate',   path: '/creator' },
    { id: 'nav-dash',    icon: '📊',  label: 'Dashboard',      desc: 'View usage & analytics',           category: 'Navigate',   path: '/dashboard' },
    { id: 'nav-profile', icon: '👤',  label: 'Profile',        desc: 'Manage your account & memory',     category: 'Navigate',   path: '/profile' },
    { id: 'nav-upgrade', icon: '⚡',  label: 'Upgrade Plan',   desc: 'Get more credits & features',      category: 'Navigate',   path: '/upgrade' },
    { id: 'agent-code',  icon: '🧑‍💻', label: 'Switch: Coder',  desc: 'Activate the coding agent mode',   category: 'Agents',     agentType: 'coding' },
    { id: 'agent-gen',   icon: '🤖',  label: 'Switch: Chat Bot', desc: 'Switch to general assistant mode', category: 'Agents',   agentType: 'general' },
    { id: 'agent-data',  icon: '📊',  label: 'Switch: Analyst', desc: 'Switch to data analyst agent',     category: 'Agents',   agentType: 'data_analyst' },
    { id: 'agent-res',   icon: '🔍',  label: 'Switch: Researcher', desc: 'Switch to web researcher agent', category: 'Agents', agentType: 'web_researcher' },
    { id: 'theme-dark',  icon: '🌙',  label: 'Dark Mode',      desc: 'Switch to dark theme',             category: 'Themes' },
    { id: 'theme-light', icon: '☀️',  label: 'Light Mode',     desc: 'Switch to light theme',            category: 'Themes' },
    { id: 'logout',      icon: '🚪',  label: 'Logout',         desc: 'Sign out of your account',         category: 'Actions' },
];

export default function CommandPalette({ open, onClose, onNewChat, onAgentChange, onThemeChange }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const navigate = useNavigate();

    const filtered = query.trim()
        ? COMMANDS.filter(c =>
            c.label.toLowerCase().includes(query.toLowerCase()) ||
            c.desc.toLowerCase().includes(query.toLowerCase()) ||
            c.category.toLowerCase().includes(query.toLowerCase())
          )
        : COMMANDS;

    useEffect(() => {
        if (open) {
            setQuery('');
            setSelected(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => { setSelected(0); }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selected]);

    const execute = useCallback((cmd) => {
        onClose();
        if (cmd.path) { navigate(cmd.path); return; }
        if (cmd.id === 'new-chat') { onNewChat?.(); return; }
        if (cmd.agentType) { onAgentChange?.(cmd.agentType); return; }
        if (cmd.id === 'theme-dark') { onThemeChange?.('dark'); return; }
        if (cmd.id === 'theme-light') { onThemeChange?.('light'); return; }
        if (cmd.id === 'logout') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/auth');
        }
    }, [navigate, onClose, onNewChat, onAgentChange, onThemeChange]);

    function handleKey(e) {
        if (e.key === 'Escape') { onClose(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return; }
        if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); execute(filtered[selected]); }
    }

    if (!open) return null;

    // Group by category
    const groups = {};
    filtered.forEach((cmd, i) => {
        if (!groups[cmd.category]) groups[cmd.category] = [];
        groups[cmd.category].push({ ...cmd, _idx: i });
    });

    return (
        <div className="cmd-overlay" onClick={onClose}>
            <div className="cmd-modal" onClick={e => e.stopPropagation()}>
                <div className="cmd-search-row">
                    <span className="cmd-search-icon">⌘</span>
                    <input
                        ref={inputRef}
                        className="cmd-input"
                        placeholder="Type a command or navigate..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKey}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {query && (
                        <button className="cmd-clear" onClick={() => setQuery('')}>✕</button>
                    )}
                    <kbd className="cmd-esc-key">ESC</kbd>
                </div>

                <div className="cmd-list" ref={listRef}>
                    {filtered.length === 0 ? (
                        <div className="cmd-empty">No commands found for "{query}"</div>
                    ) : (
                        Object.entries(groups).map(([cat, cmds]) => (
                            <div key={cat}>
                                <div className="cmd-group-label">{cat}</div>
                                {cmds.map(cmd => (
                                    <div
                                        key={cmd.id}
                                        data-idx={cmd._idx}
                                        className={`cmd-item ${selected === cmd._idx ? 'selected' : ''}`}
                                        onMouseEnter={() => setSelected(cmd._idx)}
                                        onClick={() => execute(cmd)}
                                    >
                                        <span className="cmd-item-icon">{cmd.icon}</span>
                                        <div className="cmd-item-info">
                                            <span className="cmd-item-label">{cmd.label}</span>
                                            <span className="cmd-item-desc">{cmd.desc}</span>
                                        </div>
                                        {selected === cmd._idx && (
                                            <kbd className="cmd-enter-key">↵</kbd>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                <div className="cmd-footer">
                    <span><kbd>↑↓</kbd> Navigate</span>
                    <span><kbd>↵</kbd> Execute</span>
                    <span><kbd>Esc</kbd> Close</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.4 }}>⌘K to open</span>
                </div>
            </div>
        </div>
    );
}
