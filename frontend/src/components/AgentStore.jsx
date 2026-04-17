import { useEffect, useRef } from 'react';

const AGENTS = [
    {
        id: 'coding',
        icon: '🧑‍💻',
        name: 'Senior Coder',
        tagline: 'Write, debug, and architect code',
        desc: 'Expert-level assistant for programming tasks. Handles code generation, debugging, architecture decisions, and technical explanations.',
        badges: ['Code Generation', 'Debugging', 'Architecture'],
        color: '#4285f4',
        gradient: 'linear-gradient(135deg, #4285f4 0%, #a78bfa 100%)',
    },
    {
        id: 'general',
        icon: '🤖',
        name: 'Chat Bot',
        tagline: 'Your all-purpose AI assistant',
        desc: 'A versatile assistant for brainstorming, creative writing, research summaries, Q&A, and friendly open-ended conversations.',
        badges: ['Q&A', 'Creative', 'Brainstorm'],
        color: '#10a37f',
        gradient: 'linear-gradient(135deg, #10a37f 0%, #34d399 100%)',
    },
    {
        id: 'data_analyst',
        icon: '📊',
        name: 'Data Analyst',
        tagline: 'Insights from raw data',
        desc: 'Specialized in analyzing data, spotting trends, building data pipelines, and generating insights with statistical explanations.',
        badges: ['Analytics', 'SQL', 'Statistics', 'Visualization'],
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #fb7185 100%)',
    },
    {
        id: 'web_researcher',
        icon: '🔍',
        name: 'Web Researcher',
        tagline: 'Deep-dive research reports',
        desc: 'Compiles exhaustive research reports on any topic with structured headings, summaries, pros/cons, and cited sources.',
        badges: ['Research', 'Reports', 'Summarize', 'Deep Dive'],
        color: '#a78bfa',
        gradient: 'linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%)',
    },
];

export default function AgentStore({ open, onClose, activeAgent, onSelect }) {
    const overlayRef = useRef(null);

    useEffect(() => {
        function handler(e) { if (e.key === 'Escape') onClose(); }
        if (open) document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="agent-store-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
            <div className="agent-store-modal">
                <div className="agent-store-header">
                    <div>
                        <h2 className="agent-store-title">✨ Agent Persona Store</h2>
                        <p className="agent-store-subtitle">Select a specialized AI persona for your current chat</p>
                    </div>
                    <button className="agent-store-close" onClick={onClose}>✕</button>
                </div>

                <div className="agent-store-grid">
                    {AGENTS.map(agent => {
                        const isActive = activeAgent === agent.id;
                        return (
                            <div
                                key={agent.id}
                                className={`agent-card ${isActive ? 'active' : ''}`}
                                style={{ '--agent-color': agent.color, '--agent-gradient': agent.gradient }}
                                onClick={() => { onSelect(agent.id); onClose(); }}
                            >
                                <div className="agent-card-icon-wrap">
                                    <span className="agent-card-icon">{agent.icon}</span>
                                    {isActive && <span className="agent-card-active-badge">Active</span>}
                                </div>
                                <div className="agent-card-name">{agent.name}</div>
                                <div className="agent-card-tagline">{agent.tagline}</div>
                                <p className="agent-card-desc">{agent.desc}</p>
                                <div className="agent-card-badges">
                                    {agent.badges.map(b => (
                                        <span key={b} className="agent-card-badge">{b}</span>
                                    ))}
                                </div>
                                <button className={`agent-card-btn ${isActive ? 'active' : ''}`}>
                                    {isActive ? '✓ Currently Active' : 'Select Agent →'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
