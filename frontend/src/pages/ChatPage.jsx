import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/api';
import CreditBadge from '../components/CreditBadge';
import CodeBlock from '../components/CodeBlock';
import PreviewPanel from '../components/PreviewPanel';
import { hasPreviewableCode } from '../utils/codeExtractor';

// ── Prompt Templates ────────────────────────────────────────────────────────
const PROMPT_TEMPLATES = [
    {
        category: '💻 Code',
        items: [
            { label: 'Build a REST API', prompt: 'Build a complete REST API in Node.js with Express that includes CRUD endpoints, input validation, and error handling.' },
            { label: 'React component', prompt: 'Create a reusable React component for a [describe component]. Include props, state management, and proper TypeScript types.' },
            { label: 'SQL query', prompt: 'Write an optimized SQL query to [describe what you need]. Explain the query and suggest any relevant indexes.' },
            { label: 'Unit tests', prompt: 'Write comprehensive unit tests for the following code using Jest:\n\n```\n[paste your code here]\n```' },
        ],
    },
    {
        category: '🐛 Debug',
        items: [
            { label: 'Debug my code', prompt: 'Debug the following code and explain what is wrong and how to fix it:\n\n```\n[paste your code here]\n```' },
            { label: 'Fix error', prompt: 'I\'m getting this error:\n\n```\n[paste error message]\n```\n\nHere\'s my code:\n\n```\n[paste your code]\n```\n\nWhat\'s causing it and how do I fix it?' },
            { label: 'Performance issue', prompt: 'My code is running slowly. Please analyze this and suggest optimizations:\n\n```\n[paste your code]\n```' },
        ],
    },
    {
        category: '📖 Explain',
        items: [
            { label: 'Explain concept', prompt: 'Explain [concept] clearly with a simple analogy and a practical code example. Assume I\'m an intermediate developer.' },
            { label: 'Code review', prompt: 'Review this code and provide feedback on quality, security, performance, and best practices:\n\n```\n[paste your code]\n```' },
            { label: 'Compare approaches', prompt: 'Compare and contrast [approach A] vs [approach B] for [use case]. Include pros, cons, and when to use each.' },
        ],
    },
    {
        category: '⚡ Productivity',
        items: [
            { label: 'Regex pattern', prompt: 'Write a regex pattern that matches [describe what you need to match]. Include explanation and test cases.' },
            { label: 'Shell script', prompt: 'Write a bash/PowerShell script that [describe what the script should do]. Include comments and error handling.' },
        ],
    },
];

const SUGGESTIONS = [
    '🐛 Debug my Python code',
    '⚡ Build a REST API in Node.js',
    '📊 Explain Big O notation',
    '🔒 How to secure a JWT auth system',
];
const MAX_CHARS = 8000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const API_BASE = '/api';

function formatTime(date) {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

function makeMarkdownComponents() {
    return {
        // Prevent React Markdown from wrapping block elements inside <p>
        p({ node, children }) {
            return <div className="md-p" style={{ marginBottom: '1em' }}>{children}</div>;
        },
        code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            if (!match && String(children).indexOf('\n') === -1) {
                return <code className="inline-code" {...props}>{children}</code>;
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
        },
    };
}

export default function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [credits, setCredits] = useState(null);
    const [maxCredits] = useState(4);
    const [pageLoading, setPageLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
    const [previewContent, setPreviewContent] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const [announcementDismissed, setAnnouncementDismissed] = useState(false);
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('chatModel') || 'gemini');
    const [selectedBot, setSelectedBot] = useState(() => localStorage.getItem('botType') || 'coding');

    // Chat history
    const [chatSessions, setChatSessions] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null = not searching
    const searchDebounceRef = useRef(null);

    // Prompt templates
    const [showTemplates, setShowTemplates] = useState(false);
    const templatePanelRef = useRef(null);

    // File upload
    const [attachedFile, setAttachedFile] = useState(null); // { file, previewUrl, name }
    const [fileError, setFileError] = useState('');
    const fileInputRef = useRef(null);
    // Plus menu
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const plusMenuRef = useRef(null);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const abortControllerRef = useRef(null);
    const mdComponents = makeMarkdownComponents();
    const navigate = useNavigate();

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('botType', selectedBot);
    }, [selectedBot]);

    useEffect(() => {
        const stored = (() => {
            try { return localStorage.getItem('user'); } catch { return null; }
        })();

        if (!stored) {
            navigate('/auth');
            return;
        }

        try {
            const u = JSON.parse(stored);
            if (!u || !u.id) throw new Error('Invalid user data');
            setUser(u);
            setCredits(u.credits);
            fetchLatestCredits();
            loadConversationList();
        } catch (e) {
            console.error('Auth check failed:', e);
            try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } catch { }
            navigate('/auth');
            return;
        } finally {
            setPageLoading(false);
        }

        // Fetch announcement
        fetch('/api/auth/announcement')
            .then(r => r.json())
            .then(d => { if (d.announcement) setAnnouncement(d.announcement); })
            .catch(() => { });
    }, []);

    useEffect(() => {
        const list = messagesEndRef.current?.parentElement;
        if (list) {
            const isAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 150;
            if (isAtBottom || messages.length <= 1) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages, loading]);

    // Close template panel on outside click
    useEffect(() => {
        function handleClick(e) {
            if (templatePanelRef.current && !templatePanelRef.current.contains(e.target)) {
                setShowTemplates(false);
            }
        }
        if (showTemplates) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showTemplates]);

    // Close plus menu on outside click
    useEffect(() => {
        function handleClick(e) {
            if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
                setShowPlusMenu(false);
            }
        }
        if (showPlusMenu) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showPlusMenu]);

    async function fetchLatestCredits() {
        try {
            const res = await api.get('/user/me');
            const u = res.data.user; // API returns { user: { ... } }
            if (u) {
                setCredits(u.credits);
                const stored = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...stored, credits: u.credits, role: u.role }));
            }
        } catch (e) { console.error('Failed to fetch credits:', e); }
    }

    async function loadConversationList() {
        try {
            const res = await api.get('/chats');
            setChatSessions(res.data.conversations);
        } catch { }
    }

    // ── Search ────────────────────────────────────────────────────────────────
    function handleSearchChange(e) {
        const q = e.target.value;
        setSearchQuery(q);
        clearTimeout(searchDebounceRef.current);
        if (!q.trim()) { setSearchResults(null); return; }
        // Client-side fast filter on titles
        const local = chatSessions.filter(s => s.title.toLowerCase().includes(q.toLowerCase()));
        setSearchResults(local);
        // Also search message content via API (debounced)
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await api.get(`/chats/search?q=${encodeURIComponent(q)}`);
                setSearchResults(res.data.conversations);
            } catch { }
        }, 400);
    }

    function clearSearch() {
        setSearchQuery('');
        setSearchResults(null);
    }

    // ── Conversation management ───────────────────────────────────────────────
    async function loadConversation(conv) {
        setSidebarOpen(false);
        clearSearch();
        setHistoryLoading(true);
        try {
            const res = await api.get(`/chats/${conv.id}`);
            setActiveConvId(conv.id);
            if (res.data.conversation && res.data.conversation.bot_type) {
                setSelectedBot(res.data.conversation.bot_type);
            }
            setMessages(res.data.messages.map(m => ({ ...m, time: m.created_at })));
            setPreviewContent(null);
        } catch { }
        finally { setHistoryLoading(false); }
    }

    function handleNewChat() {
        if (loading) abortControllerRef.current?.abort();
        setActiveConvId(null);
        setMessages([]);
        setInput('');
        setShowNoCreditsModal(false);
        setLoading(false);
        setPreviewContent(null);
        setSidebarOpen(false);
        clearAttachment();
        clearSearch();
        if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.focus(); }
    }

    async function deleteConversation(e, id) {
        e.stopPropagation();
        try {
            await api.delete(`/chats/${id}`);
            setChatSessions(prev => prev.filter(s => s.id !== id));
            if (searchResults) setSearchResults(prev => prev?.filter(s => s.id !== id));
            if (id === activeConvId) handleNewChat();
        } catch { }
    }

    function handleLogout() {
        if (loading) abortControllerRef.current?.abort();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
    }

    function handleStop() {
        abortControllerRef.current?.abort();
        setLoading(false);
    }

    // ── File attachment ───────────────────────────────────────────────────────
    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            setFileError('File too large. Max size is 5MB.');
            e.target.value = '';
            return;
        }
        setFileError('');
        const previewUrl = URL.createObjectURL(file);
        setAttachedFile({ file, previewUrl, name: file.name });
        e.target.value = '';
    }

    function clearAttachment() {
        if (attachedFile?.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);
        setAttachedFile(null);
        setFileError('');
    }

    // ── Template handling ─────────────────────────────────────────────────────
    function applyTemplate(prompt) {
        setInput(prompt);
        setShowTemplates(false);
        textareaRef.current?.focus();
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }

    // ── Send message ──────────────────────────────────────────────────────────
    async function sendMessage(text) {
        const msg = text.trim();
        if (!msg || loading) return;

        const currentFile = attachedFile;
        const previewUrl = currentFile?.previewUrl;

        const userMsg = {
            role: 'user',
            content: msg,
            time: new Date(),
            imageUrl: previewUrl || null,
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        clearAttachment();
        setLoading(true);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        abortControllerRef.current = new AbortController();

        const placeholder = { role: 'model', content: '', time: new Date(), streaming: true };
        setMessages(prev => [...prev, placeholder]);

        try {
            const token = localStorage.getItem('token');

            // Build request: multipart if image attached, JSON otherwise
            let fetchOptions;
            if (currentFile) {
                const formData = new FormData();
                formData.append('message', msg);
                if (activeConvId) formData.append('conversationId', String(activeConvId));
                formData.append('history', JSON.stringify(messages.slice(-10).map(m => ({ role: m.role, content: m.content }))));
                formData.append('image', currentFile.file);
                formData.append('model', 'gemini'); // force Gemini for image uploads
                formData.append('botType', selectedBot);
                fetchOptions = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData,
                    signal: abortControllerRef.current.signal,
                };
            } else {
                fetchOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        message: msg,
                        conversationId: activeConvId,
                        model: selectedModel,
                        botType: selectedBot,
                        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                    }),
                    signal: abortControllerRef.current.signal,
                };
            }

            const response = await fetch(`${API_BASE}/agent/chat`, fetchOptions);

            if (!response.ok) {
                const data = await response.json();
                if (response.status === 402) { setShowNoCreditsModal(true); setMessages(prev => prev.slice(0, -1)); setLoading(false); return; }
                throw new Error(data.error || 'Server error');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');

                // Keep the last part in the buffer if it's incomplete
                buffer = parts.pop();

                for (const part of parts) {
                    if (!part.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(part.slice(6));

                        if (event.type === 'conversation') {
                            setActiveConvId(event.conversationId);
                            if (event.botType) setSelectedBot(event.botType);
                            setChatSessions(prev => {
                                const exists = prev.find(s => s.id === event.conversationId);
                                if (exists) return prev;
                                return [{ id: event.conversationId, title: event.title, bot_type: event.botType, updated_at: new Date().toISOString() }, ...prev];
                            });
                        }
                        if (event.type === 'chunk') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.streaming) {
                                    updated[updated.length - 1] = { ...last, content: event.text };
                                }
                                return updated;
                            });
                        }
                        if (event.type === 'done') {
                            setCredits(event.credits);
                            const stored = JSON.parse(localStorage.getItem('user') || '{}');
                            localStorage.setItem('user', JSON.stringify({ ...stored, credits: event.credits }));
                            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
                            loadConversationList();
                        }
                        if (event.type === 'error') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.streaming) { last.content = `⚠️ ${event.error}`; last.streaming = false; last.isError = true; }
                                return updated;
                            });
                            throw new Error(event.error);
                        }
                    } catch (e) {
                        if (e.message !== "AI service error. Please try again." && e.message !== "You exceeded your current quota") {
                            console.error("Stream parse error", e);
                        }
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
                return;
            }
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) { last.content = `⚠️ ${err.message}`; last.streaming = false; last.isError = true; }
                return updated;
            });
        } finally {
            setLoading(false);
            textareaRef.current?.focus();
        }
    }

    async function regenerateLastMessage() {
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        if (!lastUser || loading) return;
        setMessages(prev => {
            const idx = [...prev].map(m => m.role).lastIndexOf('model');
            return idx >= 0 ? prev.slice(0, idx) : prev;
        });
        await sendMessage(lastUser.content);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
        if (e.key === 'Escape') { setShowTemplates(false); }
    }

    function handleTextareaChange(e) {
        if (e.target.value.length > MAX_CHARS) return;
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    }

    const userInitial = user?.username?.[0]?.toUpperCase() || '?';
    const charCount = input.length;
    const charPct = (charCount / MAX_CHARS) * 100;
    const isNearLimit = charCount > MAX_CHARS * 0.85;
    const hasMessages = messages.length > 0;
    const lastIsAgent = messages.length > 0 && messages[messages.length - 1]?.role === 'model' && !messages[messages.length - 1]?.streaming;
    const displayedSessions = searchResults !== null ? searchResults : chatSessions;

    if (pageLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'white' }}>
                <div className="thinking-bubble">
                    <div className="thinking-dot" /><div className="thinking-dot" /><div className="thinking-dot" />
                </div>
            </div>
        );
    }

    return (
        <div className={`chat-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* ── Sidebar ── */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                {/* Fixed top */}
                <div className="sidebar-top">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">🤖</div>
                        <span className="sidebar-logo-text">Nickxor</span>
                    </div>
                    <button className="btn-new-chat" onClick={handleNewChat} disabled={loading}>
                        <span>✏️</span> New Chat
                    </button>
                </div>

                {/* Scrollable middle */}
                <div className="sidebar-scroll">
                    <div className="sidebar-divider" />

                    {/* Navigation links */}
                    <div className="sidebar-section-label">Navigation</div>
                    <nav className="sidebar-nav">
                        <Link to="/creator" className="sidebar-nav-link" onClick={() => setSidebarOpen(false)}>🛠️ Web Creator</Link>
                        <Link to="/dashboard" className="sidebar-nav-link" onClick={() => setSidebarOpen(false)}>📊 Dashboard</Link>
                        <Link to="/profile" className="sidebar-nav-link" onClick={() => setSidebarOpen(false)}>👤 Profile</Link>
                        <Link to="/upgrade" className="sidebar-nav-link" onClick={() => setSidebarOpen(false)}>⚡ Upgrade</Link>
                        {user?.role === 'admin' && (
                            <Link to="/admin" className="sidebar-nav-link admin-link" onClick={() => setSidebarOpen(false)}>🛡️ Admin Panel</Link>
                        )}
                    </nav>

                    <div className="sidebar-divider" />

                    {/* Chat History */}
                    <div className="sidebar-section-label">Chat History</div>

                    {/* Search box — inside Chat History block */}
                    <div className="sidebar-search">
                        <span className="sidebar-search-icon">🔍</span>
                        <input
                            type="text"
                            className="sidebar-search-input"
                            placeholder="Search chats…"
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                        {searchQuery && (
                            <button className="sidebar-search-clear" onClick={clearSearch}>✕</button>
                        )}
                    </div>

                    {searchQuery && (
                        <div className="search-count">
                            {displayedSessions.length} result{displayedSessions.length !== 1 ? 's' : ''} for "{searchQuery}"
                        </div>
                    )}
                    <div className="chat-history-list">
                        {historyLoading ? (
                            <div className="history-empty">Loading…</div>
                        ) : displayedSessions.length === 0 ? (
                            <div className="history-empty">
                                {searchQuery ? 'No chats found' : 'No chats yet'}
                            </div>
                        ) : (
                            displayedSessions.map(session => (
                                <div
                                    key={session.id}
                                    className={`history-item ${session.id === activeConvId ? 'active' : ''}`}
                                    onClick={() => loadConversation(session)}
                                    title={session.title}
                                >
                                    <span className="history-icon">💬</span>
                                    <span className="history-title">{session.title}</span>
                                    <button className="history-delete" onClick={(e) => deleteConversation(e, session.id)} title="Delete">✕</button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="sidebar-divider" />
                    <div className="sidebar-section-label">Agent Settings</div>
                    <div className="show-mobile" style={{ padding: '0 4px 10px' }}>
                        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 20, padding: 3, gap: 2, border: '1px solid var(--border)' }}>
                            {[{ id: 'gemini', label: '✦ AI Agent', color: '#4285f4' }, { id: 'deepseek', label: '◈ DeepSeek', color: '#10a37f' }].map(m => (
                                <button key={m.id}
                                    onClick={() => { setSelectedModel(m.id); localStorage.setItem('chatModel', m.id); }}
                                    style={{
                                        flex: 1, padding: '6px 0', borderRadius: 16, border: 'none', cursor: 'pointer',
                                        fontSize: 11, fontWeight: 500, transition: 'all 0.15s',
                                        background: selectedModel === m.id ? m.color : 'transparent',
                                        color: selectedModel === m.id ? '#fff' : 'var(--text-muted)',
                                    }}
                                >{m.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="agent-badge">
                        <div className="agent-badge-icon">✨</div>
                        <div className="agent-badge-info">
                            <div className="agent-badge-name">{selectedBot === 'coding' ? 'Senior Agent' : 'Chat Bot'}</div>
                            <div className="agent-badge-model">AI Agent</div>
                        </div>
                    </div>

                    {credits !== null && (
                        <>
                            <div className="sidebar-section-label">Credits</div>
                            <CreditBadge credits={credits} maxCredits={maxCredits} />
                        </>
                    )}
                </div>

                {/* Fixed bottom — user info + theme + logout */}
                <div className="sidebar-user">
                    {user && (
                        <div className="user-info">
                            <div className="user-avatar" style={{ background: user.avatar_color || '#4f8ef7' }}>{userInitial}</div>
                            <div className="user-details">
                                <div className="user-name">{user.username}</div>
                                <div className="user-email">{user.email}</div>
                            </div>
                            <button
                                className="btn-theme"
                                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {theme === 'dark' ? '☀️' : '🌙'}
                            </button>
                        </div>
                    )}
                    <button className="btn-logout" onClick={handleLogout}><span>🚪</span> Logout</button>
                </div>
            </aside>


            {/* ── Announcement Banner ── */}
            {announcement && !announcementDismissed && (
                <div className="announcement-banner">
                    <span className="announcement-icon">📢</span>
                    <span className="announcement-text">{announcement}</span>
                    <button className="announcement-dismiss" onClick={() => setAnnouncementDismissed(true)}>✕</button>
                </div>
            )}

            {/* ── Chat Main ── */}
            <main className="chat-main">
                <div className="chat-header">
                    <button className="btn-hamburger" onClick={() => setSidebarOpen(o => !o)}>{sidebarOpen ? '✕' : '☰'}</button>
                    <div className="status-dot" />
                    <select
                        className="chat-header-title"
                        value={selectedBot}
                        onChange={(e) => setSelectedBot(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            fontSize: 'inherit',
                            fontWeight: 'inherit',
                            cursor: 'pointer',
                            outline: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            appearance: 'none',
                            fontFamily: 'inherit',
                            padding: 0,
                            margin: 0
                        }}
                    >
                        <option value="coding" style={{ color: '#000', background: '#fff' }}>Senior AI Coding Agent</option>
                        <option value="general" style={{ color: '#000', background: '#fff' }}>Chat Bot</option>
                    </select>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Model Selector */}
                        <div className="hidden-mobile" style={{ display: 'flex', background: 'var(--bg-2, #f3f4f6)', borderRadius: 20, padding: 3, gap: 2, border: '1px solid var(--border, #e5e7eb)' }}>
                            {[{ id: 'gemini', label: '✦ AI Agent', color: '#4285f4' }, { id: 'deepseek', label: '◈ DeepSeek', color: '#10a37f' }].map(m => (
                                <button key={m.id}
                                    onClick={() => { setSelectedModel(m.id); localStorage.setItem('chatModel', m.id); }}
                                    style={{
                                        padding: '3px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                                        fontSize: 11, fontWeight: 500, transition: 'all 0.15s',
                                        background: selectedModel === m.id ? m.color : 'transparent',
                                        color: selectedModel === m.id ? '#fff' : 'var(--text-muted, #6b7280)',
                                    }}
                                >{m.label}</button>
                            ))}
                        </div>
                        {/* Alternative Mobile Selector Icon or simplified version could go here if needed, 
                            but for now let's just make the existing one fit better or show in sidebar */}
                        {hasMessages && (
                            <button className="btn-header-new-chat" onClick={handleNewChat} disabled={loading} title="New chat">
                                <span className="hidden-mobile">✏️ New Chat</span>
                                <span className="show-mobile">✏️</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="chat-messages">
                    <div className="chat-container-inner">
                        {messages.length === 0 && !loading ? (
                            <div className="chat-welcome">
                                <div className="chat-welcome-icon">🤖</div>
                                <h2>How can I help you today?</h2>
                                <p>
                                    {selectedBot === 'coding' 
                                        ? "I'm your AI Coding & Task Automation Agent. Write code, debug errors, explain concepts, or automate tasks."
                                        : "I'm your friendly Chat Bot. Ask me anything, brainstorm ideas, or just chat."}
                                </p>
                                <div className="welcome-chips">
                                    {SUGGESTIONS.map(s => (
                                        <button key={s} className="welcome-chip" onClick={() => sendMessage(s)}>{s}</button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, i) => (
                                    <div key={i} id={`message-${i}`} className={`message ${msg.role === 'user' ? 'user' : 'agent'}`}>
                                        <div className="message-avatar">{msg.role === 'user' ? userInitial : '🤖'}</div>
                                        <div className="message-content">
                                            <div className="message-bubble"
                                                style={msg.isError ? { borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' } : {}}>
                                                {/* Show image if user attached one */}
                                                {msg.imageUrl && (
                                                    <div className="message-image-wrap">
                                                        <img src={msg.imageUrl} alt="Attached" className="message-image" />
                                                    </div>
                                                )}
                                                {msg.role === 'user' ? msg.content : (
                                                    <>
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.content}</ReactMarkdown>
                                                        {msg.streaming && <span className="stream-cursor" />}
                                                    </>
                                                )}
                                            </div>
                                            <div className="message-model-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                {msg.role === 'model' && !msg.streaming && hasPreviewableCode(msg.content) && (
                                                    <button
                                                        className={`btn-preview-trigger ${previewContent === msg.content ? 'active' : ''}`}
                                                        style={{ margin: 0 }}
                                                        onClick={() => setPreviewContent(previewContent === msg.content ? null : msg.content)}
                                                    >
                                                        {previewContent === msg.content ? '✕ Close Preview' : '▶ Open Preview'}
                                                    </button>
                                                )}
                                                {msg.role === 'model' && !msg.streaming && (
                                                    <button
                                                        className="btn-preview-trigger"
                                                        style={{ margin: 0 }}
                                                        title="Scroll to the start of this answer"
                                                        onClick={() => {
                                                            const targetId = i > 0 ? `message-${i - 1}` : `message-${i}`;
                                                            const el = document.getElementById(targetId);
                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }}
                                                    >
                                                        ↑ Go to Last Prompt
                                                    </button>
                                                )}
                                            </div>
                                            <div className="message-time">{formatTime(msg.time)}</div>
                                        </div>
                                    </div>
                                ))}

                                {loading && messages[messages.length - 1]?.role !== 'model' && (
                                    <div className="message agent">
                                        <div className="message-avatar">🤖</div>
                                        <div className="message-content">
                                            <div className="thinking-bubble">
                                                <div className="thinking-dot" /><div className="thinking-dot" /><div className="thinking-dot" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!loading && lastIsAgent && (
                                    <div className="message-actions-row" style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                                        <button className="btn-action" onClick={regenerateLastMessage}>🔄 Regenerate</button>
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} style={{ height: 1 }} />
                    </div>
                </div>

                <div className="chat-input-area">
                    <div className="chat-container-inner" style={{ position: 'relative', paddingBottom: '10px' }}>
                        {/* File preview bar */}
                        {attachedFile && (
                            <div className="file-preview-bar">
                                <img src={attachedFile.previewUrl} alt="preview" className="file-preview-thumb" />
                                <span className="file-preview-name">{attachedFile.name}</span>
                                <button className="file-preview-remove" onClick={clearAttachment} title="Remove">✕</button>
                            </div>
                        )}
                        {fileError && <div className="file-error-msg">{fileError}</div>}

                        <div className="input-row-outer">
                            {/* Circular Plus Button */}
                            <div className="plus-menu-container" ref={plusMenuRef}>
                                <button 
                                    className={`btn-plus ${showPlusMenu ? 'active' : ''}`}
                                    onClick={() => setShowPlusMenu(s => !s)}
                                    title="Attachments & Actions"
                                >
                                    <span>+</span>
                                </button>
                                
                                {showPlusMenu && (
                                    <div className="plus-menu-dropdown">
                                        <button className="plus-menu-item" onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}>
                                            <span className="plus-item-icon">🖼️</span>
                                            <span className="plus-item-label">Upload Image</span>
                                        </button>
                                        <button className="plus-menu-item" onClick={() => { setShowTemplates(true); setShowPlusMenu(false); }}>
                                            <span className="plus-item-icon">📋</span>
                                            <span className="plus-item-label">Prompt Templates</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Pill-shaped Input Wrapper */}
                            <div className="input-wrapper-pill">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />
                                
                                <textarea
                                    ref={textareaRef}
                                    className="chat-textarea"
                                    placeholder="Ask me anything…"
                                    value={input}
                                    onChange={handleTextareaChange}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    disabled={credits === 0 && credits !== 'Unlimited'}
                                />
                                
                                {charCount > 0 && (
                                    <div className="char-counter" title={`${charCount} / ${MAX_CHARS}`}>
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                                            <circle cx="12" cy="12" r="10" fill="none"
                                                stroke={isNearLimit ? 'var(--red)' : 'var(--accent)'}
                                                strokeWidth="2.5"
                                                strokeDasharray={`${2 * Math.PI * 10}`}
                                                strokeDashoffset={`${2 * Math.PI * 10 * (1 - charPct / 100)}`}
                                                strokeLinecap="round"
                                                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.2s' }}
                                            />
                                        </svg>
                                    </div>
                                )}
                                
                                {loading ? (
                                    <button className="btn-send-pill stop" onClick={handleStop} title="Stop">⏹</button>
                                ) : (
                                    <button className="btn-send-pill" onClick={() => sendMessage(input)} disabled={!input.trim() || (credits === 0 && credits !== 'Unlimited')} title="Send">➤</button>
                                )}
                            </div>
                        </div>

                        {/* Template panel */}
                        {showTemplates && (
                            <div className="template-panel" ref={templatePanelRef}>
                                <div className="template-panel-header">
                                    <span>📋 Prompt Templates</span>
                                    <button className="template-close" onClick={() => setShowTemplates(false)}>✕</button>
                                </div>
                                <div className="template-scroll">
                                    {PROMPT_TEMPLATES.map(cat => (
                                        <div key={cat.category} className="template-category">
                                            <div className="template-category-label">{cat.category}</div>
                                            {cat.items.map(item => (
                                                <button
                                                    key={item.label}
                                                    className="template-item"
                                                    onClick={() => applyTemplate(item.prompt)}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="input-hint">
                            {credits === 0 && credits !== 'Unlimited' ? '⚠️ No credits remaining'
                                : loading ? '⏹ Click stop to cancel'
                                    : `${credits === 'Unlimited' ? '∞' : (credits ?? '…')} credit${credits === 1 ? '' : 's'} remaining · 📎 attach image · 📋 templates`}
                        </div>
                    </div>
                </div>
            </main>

            {previewContent && <PreviewPanel markdown={previewContent} onClose={() => setPreviewContent(null)} />}

            {showNoCreditsModal && (
                <div className="modal-overlay" onClick={() => setShowNoCreditsModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon">💳</div>
                        <div className="modal-title">Credits Exhausted</div>
                        <div className="modal-message">You have run out of credits. Upgrade to continue using Nickxor.</div>
                        <div className="modal-actions">
                            <Link to="/upgrade" className="btn-upgrade" style={{ textDecoration: 'none', textAlign: 'center' }}>⚡ Upgrade Plan</Link>
                            <button className="btn-close" onClick={() => setShowNoCreditsModal(false)}>Maybe Later</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
