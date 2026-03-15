import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';

const API_BASE = 'http://localhost:5000/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('token'); }

function authFetch(url, opts = {}) {
    return fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}`, ...(opts.headers || {}) },
    });
}

function getMonacoLanguage(filePath = '') {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        html: 'html', css: 'css', scss: 'scss', json: 'json',
        py: 'python', rb: 'ruby', java: 'java', go: 'go',
        md: 'markdown', sql: 'sql', sh: 'shell', yml: 'yaml', yaml: 'yaml',
        php: 'php', rs: 'rust', cpp: 'cpp', c: 'c', cs: 'csharp',
        vue: 'html', svelte: 'html', xml: 'xml',
    };
    return map[ext] || 'plaintext';
}

function parseStreamingProject(rawString) {
    const files = [];
    if (rawString.trim().startsWith('<') || rawString.trim().toLowerCase().startsWith('<!doctype')) {
        return [{ path: 'index.html', content: rawString }];
    }
    const pathParts = rawString.split(/"path"\s*:\s*"/);
    if (pathParts.length < 2) return files;

    for (let i = 1; i < pathParts.length; i++) {
        let part = pathParts[i];
        const prevPart = pathParts[i - 1]; 

        const pathEndIdx = part.indexOf('"');
        if (pathEndIdx === -1) continue;
        const path = part.substring(0, pathEndIdx);
        
        let content = '';
        const contentStartMatch = part.match(/"content"\s*:\s*"/);
        if (contentStartMatch) {
            const contentStartIdx = contentStartMatch.index + contentStartMatch[0].length;
            let contentRaw = part.substring(contentStartIdx);
            
            let contentEndIdx = -1;
            for (let j = 0; j < contentRaw.length; j++) {
                if (contentRaw[j] === '"' && contentRaw[j - 1] !== '\\') {
                    let backslashes = 0;
                    for (let k = j - 1; k >= 0; k--) {
                        if (contentRaw[k] === '\\') backslashes++;
                        else break;
                    }
                    if (backslashes % 2 === 0) { contentEndIdx = j; break; }
                }
            }
            if (contentEndIdx !== -1) contentRaw = contentRaw.substring(0, contentEndIdx);
            try {
                let cleanRaw = contentRaw;
                if (cleanRaw.endsWith('\\')) cleanRaw = cleanRaw.substring(0, cleanRaw.length - 1);
                content = JSON.parse('"' + cleanRaw + '"');
            } catch (e) {
                content = contentRaw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
        }
        
        let type = 'modify';
        // Check previous part (type came before path)
        const matchBefore = prevPart.match(/"type"\s*:\s*"([^"]+)"\s*,?\s*$/);
        if (matchBefore) {
            type = matchBefore[1];
        } else {
            // Check current part (type came after path)
            const matchAfter = part.match(/"type"\s*:\s*"([^"]+)"/);
            if (matchAfter) type = matchAfter[1];
        }
        
        files.push({ path, content, type });
    }
    return files;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 14, color = 'currentColor', strokeWidth = 2 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const FolderIcon = ({ open }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={open ? "#dcb67a" : "none"} stroke="#dcb67a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

const FileIcon = ({ name }) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (ext === 'js' || ext === 'jsx') return <span style={{ color: '#f1e05a', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>JS</span>;
    if (ext === 'ts' || ext === 'tsx') return <span style={{ color: '#3178c6', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>TS</span>;
    if (ext === 'css' || ext === 'scss') return <span style={{ color: '#a371f7', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>#</span>;
    if (ext === 'html') return <span style={{ color: '#e34c26', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>&lt;&gt;</span>;
    if (ext === 'json') return <span style={{ color: '#8ca8b3', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>{'{}'}</span>;
    if (ext === 'py') return <span style={{ color: '#3673a5', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>PY</span>;
    if (ext === 'md') return <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '11px', width: '14px', display: 'inline-block', textAlign: 'center' }}>MD</span>;
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ca8b3" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>;
};

// ── File Tree Node ─────────────────────────────────────────────────────────────
function FileTreeNode({ node, depth, selectedFile, onSelect, onDelete, onRename, onNewFile, onNewFolder }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!showMenu) return;
        function outsideClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); }
        document.addEventListener('mousedown', outsideClick);
        return () => document.removeEventListener('mousedown', outsideClick);
    }, [showMenu]);

    if (node.name === 'root') {
        return (
            <div>
                {Object.values(node.children)
                    .sort((a, b) => { if (a.type !== b.type) return a.type === 'folder' ? -1 : 1; return a.name.localeCompare(b.name); })
                    .map(child => (
                        <FileTreeNode key={child.name} node={child} depth={depth} selectedFile={selectedFile}
                            onSelect={onSelect} onDelete={onDelete} onRename={onRename} onNewFile={onNewFile} onNewFolder={onNewFolder} />
                    ))}
            </div>
        );
    }

    const isActive = selectedFile?.path === node.path;
    const ctxMenuStyle = {
        position: 'absolute', zIndex: 200, right: 0, top: '100%',
        background: '#252526', border: '1px solid #454545', borderRadius: 4,
        minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', overflow: 'hidden',
    };
    const ctxItemStyle = { padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#cccccc', display: 'block', background: 'none', border: 'none', width: '100%', textAlign: 'left' };

    if (node.type === 'folder') {
        return (
            <div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', paddingLeft: `${depth * 14 + 8}px`, paddingRight: 4, cursor: 'pointer', borderRadius: 3, color: '#cccccc', fontSize: 13, height: 24 }}
                    onClick={() => setIsExpanded(!isExpanded)}>
                    <span style={{ marginRight: 2, opacity: 0.6, fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ marginRight: 4 }}><FolderIcon open={isExpanded} /></span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                    <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}>⋯</button>
                    {showMenu && (
                        <div ref={menuRef} style={ctxMenuStyle}>
                            <button style={ctxItemStyle} onClick={e => { e.stopPropagation(); setShowMenu(false); onNewFile(node.path); }}>+ New File</button>
                            <button style={ctxItemStyle} onClick={e => { e.stopPropagation(); setShowMenu(false); onNewFolder(node.path); }}>+ New Folder</button>
                            <button style={{ ...ctxItemStyle, color: '#f48771' }} onClick={e => { e.stopPropagation(); setShowMenu(false); onDelete(node.path, true); }}>🗑 Delete Folder</button>
                        </div>
                    )}
                </div>
                {isExpanded && (
                    <div>
                        {Object.values(node.children)
                            .sort((a, b) => { if (a.type !== b.type) return a.type === 'folder' ? -1 : 1; return a.name.localeCompare(b.name); })
                            .map(child => (
                                <FileTreeNode key={child.name} node={child} depth={depth + 1} selectedFile={selectedFile}
                                    onSelect={onSelect} onDelete={onDelete} onRename={onRename} onNewFile={onNewFile} onNewFolder={onNewFolder} />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    // File node
    return (
        <div style={{ position: 'relative' }}>
            <div
                style={{
                    display: 'flex', alignItems: 'center', paddingLeft: `${depth * 14 + 8 + 16}px`, paddingRight: 4,
                    cursor: 'pointer', borderRadius: 3, height: 24, fontSize: 13,
                    color: isActive ? '#ffffff' : '#cccccc',
                    background: isActive ? '#37373d' : 'transparent',
                }}
                onClick={() => onSelect(node.file)}
            >
                <span style={{ marginRight: 4 }}><FileIcon name={node.name} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1, opacity: showMenu ? 1 : 0 }}
                    className="file-ctx-btn">⋯</button>
                {showMenu && (
                    <div ref={menuRef} style={ctxMenuStyle}>
                        <button style={ctxItemStyle} onClick={e => { e.stopPropagation(); setShowMenu(false); onRename(node.path); }}>✏️ Rename</button>
                        <button style={{ ...ctxItemStyle, color: '#f48771' }} onClick={e => { e.stopPropagation(); setShowMenu(false); onDelete(node.path, false); }}>🗑 Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Model Selector ─────────────────────────────────────────────────────────────
function ModelSelector({ selectedModel, onChange }) {
    const models = [
        { id: 'gemini', label: '✦ Gemini', color: '#4285f4' },
        { id: 'deepseek', label: '◈ DeepSeek', color: '#10a37f' },
    ];
    return (
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 20, padding: 3, gap: 2, border: '1px solid #e5e7eb' }}>
            {models.map(m => (
                <button key={m.id} onClick={() => onChange(m.id)}
                    style={{
                        padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        transition: 'all 0.15s ease',
                        background: selectedModel === m.id ? m.color : 'transparent',
                        color: selectedModel === m.id ? '#fff' : '#6b7280',
                        boxShadow: selectedModel === m.id ? `0 2px 6px ${m.color}55` : 'none',
                    }}>{m.label}</button>
            ))}
        </div>
    );
}

// ── Streaming Message ──────────────────────────────────────────────────────────
const StreamingMessage = ({ text, onComplete }) => {
    const [displayed, setDisplayed] = useState('');
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        if (idx < text.length) {
            const t = setTimeout(() => { setDisplayed(p => p + text[idx]); setIdx(p => p + 1); }, 10);
            return () => clearTimeout(t);
        } else if (onComplete) onComplete();
    }, [idx, text, onComplete]);
    return <span>{displayed}</span>;
};

// ── Project Panel ──────────────────────────────────────────────────────────────
function ProjectPanel({ currentProject, onNew, onOpen, onDelete, projects, loading }) {
    const [showList, setShowList] = useState(false);
    return (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Project</span>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={onNew} title="New Project"
                        style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>+ New</button>
                    <button onClick={() => setShowList(v => !v)} title="Open Project"
                        style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>📂 Open</button>
                </div>
            </div>
            {currentProject && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                    <span style={{ fontSize: 14 }}>📁</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#166534', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentProject.name}</span>
                    <button onClick={() => onDelete(currentProject.id)} title="Delete project"
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, padding: 0 }}>🗑</button>
                </div>
            )}
            {showList && (
                <div style={{ marginTop: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                    {loading ? <div style={{ padding: 12, fontSize: 12, color: '#9ca3af' }}>Loading…</div>
                        : projects.length === 0 ? <div style={{ padding: 12, fontSize: 12, color: '#9ca3af' }}>No saved projects yet.</div>
                            : projects.map(p => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', gap: 6 }}
                                    onClick={() => { onOpen(p); setShowList(false); }}>
                                    <span style={{ fontSize: 12 }}>📁</span>
                                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.model}</span>
                                </div>
                            ))
                    }
                </div>
            )}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function WebCreatorPage() {
    const navigate = useNavigate();

    // Core state
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [projectJson, setProjectJson] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [activeTab, setActiveTab] = useState('explorer');
    const [history, setHistory] = useState([]);
    const [streamingRaw, setStreamingRaw] = useState('');

    // Model
    const [selectedModel, setSelectedModel] = useState('gemini');

    // Project persistence
    const [currentProject, setCurrentProject] = useState(null);
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const saveTimerRef = useRef(null);

    // UI
    const historyEndRef = useRef(null);

    // Suggestions
    const [suggestions, setSuggestions] = useState([
        'Add Product Pages', 'Add Shopping Cart', 'Make it mobile responsive', 'Add Dark Mode', 'Add Contact Form'
    ]);

    const streamingFiles = useMemo(() => {
        if (!loading || !streamingRaw) return null;
        return parseStreamingProject(streamingRaw);
    }, [loading, streamingRaw]);

    const currentFiles = useMemo(() => {
        if (loading && streamingFiles && streamingFiles.length > 0) {
            if (!projectJson || !projectJson.files || projectJson.files.length === 0) {
                return streamingFiles; // brand new project
            }
            // Smart Merge: stream 'changes' over existing files
            const map = new Map();
            // 1. Load all existing files
            projectJson.files.forEach(f => map.set(f.path, f));
            // 2. Overwrite/add streaming changes (AI returns "changes" or "files" with same format)
            streamingFiles.forEach(f => {
                if (f.type === 'delete') {
                    map.delete(f.path);
                } else if (f.content !== undefined) {
                    map.set(f.path, { ...map.get(f.path), ...f });
                }
            });
            return Array.from(map.values());
        }
        return projectJson?.files || [];
    }, [loading, streamingFiles, projectJson]);

    const displaySelectedFile = useMemo(() => {
        if (loading && currentFiles.length > 0) {
            if (selectedFile) {
                const updated = currentFiles.find(f => f.path === selectedFile.path);
                if (updated) return updated;
            }
            // Fallback: show the file currently being streamed
            const streamingOnly = currentFiles.filter(f => f.type !== 'delete' && f.content !== undefined);
            return streamingOnly.length > 0 ? streamingOnly[streamingOnly.length - 1] : null;
        }
        return selectedFile;
    }, [selectedFile, loading, currentFiles]);

    useEffect(() => { historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);
    useEffect(() => { if (!localStorage.getItem('token')) navigate('/auth'); }, [navigate]);
    useEffect(() => { loadProjects(); }, []);

    // Handle iframe navigation messages
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'NAVIGATE') {
                let targetPath = event.data.path;
                if (targetPath.startsWith('./')) targetPath = targetPath.substring(2);
                if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);
                const targetFile = currentFiles.find(f => f.path === targetPath || f.path === `${targetPath}.html`);
                if (targetFile) setSelectedFile(targetFile);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentFiles]);

    // ── Project CRUD ─────────────────────────────────────────────────────────
    async function loadProjects() {
        setProjectsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/projects`);
            const data = await res.json();
            setProjects(data.projects || []);
        } catch { } finally { setProjectsLoading(false); }
    }

    async function handleNewProject() {
        const name = window.prompt('Project name:');
        if (!name?.trim()) return;
        try {
            const res = await authFetch(`${API_BASE}/projects`, {
                method: 'POST', body: JSON.stringify({ name: name.trim(), model: selectedModel }),
            });
            const data = await res.json();
            if (!res.ok) return alert(data.error || 'Failed to create project.');
            setCurrentProject(data.project);
            setProjectJson(null);
            setSelectedFile(null);
            setHistory([]);
            setProjects(prev => [data.project, ...prev]);
        } catch { alert('Failed to create project.'); }
    }

    async function handleOpenProject(project) {
        try {
            const res = await authFetch(`${API_BASE}/projects/${project.id}/files`);
            const data = await res.json();
            if (!res.ok) return alert(data.error || 'Failed to load project.');
            setCurrentProject(project);
            setSelectedModel(project.model || 'gemini');
            if (data.files && data.files.length > 0) {
                const pj = { files: data.files };
                setProjectJson(pj);
                setSelectedFile(data.files[0]);
            } else {
                setProjectJson(null);
                setSelectedFile(null);
            }
            setHistory([{ role: 'model', action: `Opened project: "${project.name}"`, isStreaming: false }]);
        } catch { alert('Failed to open project.'); }
    }

    async function handleDeleteProject(projectId) {
        if (!window.confirm('Delete this project and all its files?')) return;
        try {
            const res = await authFetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
            if (!res.ok) return;
            setCurrentProject(null);
            setProjectJson(null);
            setSelectedFile(null);
            setHistory([]);
            setProjects(prev => prev.filter(p => p.id !== projectId));
        } catch { }
    }

    // Auto-save all files to current project (debounced)
    const scheduleSave = useCallback((files) => {
        if (!currentProject) return;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveFilesToProject(files), 1200);
    }, [currentProject]);

    async function saveFilesToProject(files) {
        if (!currentProject || !files || files.length === 0) return;
        try {
            await authFetch(`${API_BASE}/projects/${currentProject.id}/files/bulk`, {
                method: 'POST', body: JSON.stringify({ files }),
            });
        } catch (err) { console.error('Auto-save failed:', err); }
    }

    // ── Generate ──────────────────────────────────────────────────────────────
    async function handleGenerate(e) {
        e.preventDefault();
        if (!prompt.trim() || loading) return;

        // If no project, create one automatically
        let activeProject = currentProject;
        if (!activeProject) {
            try {
                const res = await authFetch(`${API_BASE}/projects`, {
                    method: 'POST', body: JSON.stringify({ name: prompt.trim().slice(0, 50), model: selectedModel }),
                });
                const data = await res.json();
                if (res.ok) {
                    activeProject = data.project;
                    setCurrentProject(data.project);
                    setProjects(prev => [data.project, ...prev]);
                }
            } catch { }
        }

        const currentPrompt = prompt.trim();
        setPrompt('');
        setHistory(prev => [...prev, { role: 'user', text: currentPrompt }]);
        setLoading(true);

        try {
            setStreamingRaw('');
            const response = await fetch(`${API_BASE}/webcreator/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ prompt: currentPrompt, previousJson: projectJson, model: selectedModel }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false, finalProjectData = null, buffer = '', accumulatedRaw = '', lastUpdate = Date.now();

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop();
                    for (const ev of events) {
                        const trimmedEv = ev.trim();
                        if (!trimmedEv.startsWith('data: ')) continue;
                        let data;
                        try { data = JSON.parse(trimmedEv.substring(6)); } catch { continue; }
                        if (data.type === 'chunk') {
                            accumulatedRaw += data.text;
                            if (Date.now() - lastUpdate > 50) { setStreamingRaw(accumulatedRaw); lastUpdate = Date.now(); }
                        } else if (data.type === 'done') {
                            finalProjectData = data;
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    }
                }
            }

            if (finalProjectData) {
                if (!finalProjectData.project?.files || !Array.isArray(finalProjectData.project.files)) {
                    throw new Error('Invalid project structure from AI.');
                }
                const newProject = finalProjectData.project;
                setProjectJson(newProject);

                // Update recommendations
                if (finalProjectData.recommendations && finalProjectData.recommendations.length > 0) {
                    setSuggestions(finalProjectData.recommendations);
                }

                setHistory(prev => [...prev, {
                    role: 'model',
                    action: projectJson ? 'Project updated! What would you like to change next?' : 'Project generated! What feature would you like to add next?',
                    isStreaming: true,
                }]);
                if (finalProjectData.credits !== undefined) {
                    const stored = JSON.parse(localStorage.getItem('user') || '{}');
                    localStorage.setItem('user', JSON.stringify({ ...stored, credits: finalProjectData.credits }));
                }
                if (newProject.files.length > 0) {
                    const stillExists = selectedFile && newProject.files.find(f => f.path === selectedFile.path);
                    setSelectedFile(stillExists || newProject.files[0]);
                }
                // Auto-save to project
                if (activeProject) saveFilesToProject(newProject.files);
            }
        } catch (error) {
            setHistory(prev => [...prev, { role: 'error', text: error.message }]);
        } finally {
            setLoading(false);
            setStreamingRaw('');
        }
    }

    // ── Code edit ─────────────────────────────────────────────────────────────
    function handleCodeChange(newContent) {
        if (!selectedFile || !projectJson) return;
        const updatedFiles = projectJson.files.map(f =>
            f.path === selectedFile.path ? { ...f, content: newContent } : f
        );
        const newPj = { ...projectJson, files: updatedFiles };
        setProjectJson(newPj);
        setSelectedFile({ ...selectedFile, content: newContent });
        scheduleSave(updatedFiles);
    }

    // ── File operations ───────────────────────────────────────────────────────
    function handleNewFile(folderPath) {
        const name = window.prompt('New file name (e.g. utils.js):');
        if (!name?.trim()) return;
        const safeName = name.trim().replace(/[^a-zA-Z0-9._\-]/g, '');
        const path = folderPath ? `${folderPath}/${safeName}` : safeName;
        const newFile = { path, content: '' };
        const updatedFiles = [...(projectJson?.files || []), newFile];
        const newPj = { files: updatedFiles };
        setProjectJson(newPj);
        setSelectedFile(newFile);
        scheduleSave(updatedFiles);
    }

    function handleNewFolder(parentPath) {
        const name = window.prompt('New folder name:');
        if (!name?.trim()) return;
        const safeName = name.trim().replace(/[^a-zA-Z0-9._\-]/g, '');
        const placeholder = { path: parentPath ? `${parentPath}/${safeName}/.gitkeep` : `${safeName}/.gitkeep`, content: '' };
        const updatedFiles = [...(projectJson?.files || []), placeholder];
        setProjectJson({ files: updatedFiles });
        scheduleSave(updatedFiles);
    }

    async function handleRenameFile(oldPath) {
        const newName = window.prompt('Rename to:', oldPath.split('/').pop());
        if (!newName?.trim()) return;
        const parts = oldPath.split('/');
        parts[parts.length - 1] = newName.trim();
        const newPath = parts.join('/');
        if (currentProject) {
            try {
                await authFetch(`${API_BASE}/projects/${currentProject.id}/files/rename`, {
                    method: 'PATCH', body: JSON.stringify({ oldPath, newPath }),
                });
            } catch { }
        }
        const updatedFiles = (projectJson?.files || []).map(f => f.path === oldPath ? { ...f, path: newPath } : f);
        setProjectJson({ files: updatedFiles });
        if (selectedFile?.path === oldPath) setSelectedFile({ ...selectedFile, path: newPath });
    }

    async function handleDeleteFile(filePath, isFolder) {
        const label = isFolder ? `folder "${filePath}" and all its files` : `file "${filePath}"`;
        if (!window.confirm(`Delete ${label}?`)) return;
        if (currentProject) {
            const filesToDelete = isFolder
                ? (projectJson?.files || []).filter(f => f.path === filePath || f.path.startsWith(filePath + '/'))
                : [{ path: filePath }];
            for (const f of filesToDelete) {
                try {
                    await authFetch(`${API_BASE}/projects/${currentProject.id}/files`, {
                        method: 'DELETE', body: JSON.stringify({ path: f.path }),
                    });
                } catch { }
            }
        }
        const updatedFiles = isFolder
            ? (projectJson?.files || []).filter(f => f.path !== filePath && !f.path.startsWith(filePath + '/'))
            : (projectJson?.files || []).filter(f => f.path !== filePath);
        setProjectJson({ files: updatedFiles });
        if (selectedFile?.path === filePath || (isFolder && selectedFile?.path?.startsWith(filePath + '/'))) {
            setSelectedFile(updatedFiles[0] || null);
        }
    }

    // ── File tree ─────────────────────────────────────────────────────────────
    const fileTree = useMemo(() => {
        const root = { name: 'root', type: 'folder', children: {} };
        currentFiles.forEach(file => {
            const parts = file.path.split('/');
            let current = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    current.children[part] = { name: part, type: 'file', path: file.path, file };
                } else {
                    if (!current.children[part]) current.children[part] = { name: part, type: 'folder', path: parts.slice(0, i + 1).join('/'), children: {} };
                    current = current.children[part];
                }
            }
        });
        return root;
    }, [currentFiles]);

    // ── Preview HTML ──────────────────────────────────────────────────────────
    const previewHtml = useMemo(() => {
        if (currentFiles.length === 0) return '';
        let targetHtml = currentFiles.find(f => f.path === displaySelectedFile?.path && f.path.endsWith('.html'))
            || currentFiles.find(f => f.path === 'index.html' || f.path === 'public/index.html')
            || currentFiles.find(f => f.path.endsWith('.html'));
        if (!targetHtml) return `<html><body style="font-family:sans-serif;text-align:center;padding:40px;color:#666"><h3>Preview not available</h3><p>Select an HTML file to preview it.</p></body></html>`;

        let html = targetHtml.content;
        let css = currentFiles.filter(f => f.path.endsWith('.css')).map(f => f.content).join('\n');
        let js = currentFiles.filter(f => f.path.endsWith('.js') && !f.path.includes('package.json')).map(f => f.content).join('\n');

        const interceptScript = `<script>document.addEventListener('click',function(e){const l=e.target.closest('a');if(l){let h=l.getAttribute('href');if(h&&!h.startsWith('http')&&!h.startsWith('#')&&!h.startsWith('mailto:')){e.preventDefault();window.parent.postMessage({type:'NAVIGATE',path:h},'*');}}})</script>`;
        if (html.includes('</head>')) html = html.replace('</head>', `<style>${css}</style></head>`);
        else html = `<style>${css}</style>${html}`;
        if (html.includes('</body>')) html = html.replace('</body>', `<script>${js}</script>${interceptScript}</body>`);
        else html = `${html}<script>${js}</script>${interceptScript}`;
        
        return html;
    }, [currentFiles, displaySelectedFile]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff', overflow: 'hidden' }}>

            {/* ── Top Bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 20px', borderBottom: '1px solid #e5e7eb', background: '#ffffff',
                zIndex: 10, minHeight: 52, flexShrink: 0,
            }}>
                {/* Branding */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                            {currentProject ? currentProject.name : 'AI Web Builder'}
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                            {currentProject ? `Project · ${currentProject.model}` : 'No project open'}
                        </div>
                    </div>
                </div>

                {/* Center: Model selector + View toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ModelSelector selectedModel={selectedModel} onChange={setSelectedModel} />
                    <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 20, padding: 3, gap: 2, border: '1px solid #e5e7eb' }}>
                        {[{ id: 'preview', icon: '👁', label: 'Preview' }, { id: 'explorer', icon: '</>', label: 'Code' }].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                                    fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                                    background: activeTab === tab.id ? '#ffffff' : 'transparent',
                                    color: activeTab === tab.id ? '#111827' : '#6b7280',
                                    boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                }}>{tab.icon} {tab.label}</button>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {currentProject && (
                        <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                            Auto-saved
                        </div>
                    )}
                    <button onClick={() => navigate('/chat')} style={{ border: '1px solid #e5e7eb', background: 'transparent', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#374151' }}>💬 Chat</button>
                    <button style={{ border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>🚀 Deploy</button>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── Left Panel: Chat + Projects ── */}
                <div style={{
                    width: 300, minWidth: 260, maxWidth: 380, display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0, overflow: 'hidden',
                }}>
                    {/* Project panel */}
                    <ProjectPanel
                        currentProject={currentProject}
                        projects={projects}
                        loading={projectsLoading}
                        onNew={handleNewProject}
                        onOpen={handleOpenProject}
                        onDelete={handleDeleteProject}
                    />

                    {/* Chat history */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {history.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
                                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Describe your project</div>
                                <div style={{ fontSize: 12 }}>e.g. "Create a React landing page for a coffee shop"</div>
                            </div>
                        ) : (
                            history.map((msg, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                    {msg.role === 'user' ? (
                                        <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', padding: '8px 12px', borderRadius: '12px 12px 2px 12px', fontSize: 13, maxWidth: '85%' }}>{msg.text}</div>
                                    ) : msg.role === 'error' ? (
                                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '12px 12px 12px 2px', fontSize: 13, maxWidth: '85%' }}>⚠️ {msg.text}</div>
                                    ) : (
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: '12px 12px 12px 2px', fontSize: 13, maxWidth: '85%' }}>
                                            ⚙️ {msg.isStreaming ? <StreamingMessage text={msg.action} onComplete={() => setHistory(prev => prev.map((m, i) => i === idx ? { ...m, isStreaming: false } : m))} /> : msg.action}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '8px 12px', borderRadius: '12px 12px 12px 2px', fontSize: 13 }}>
                                    ⚙️ Generating with {selectedModel}…
                                    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6 }}>
                                        {[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={historyEndRef} />
                    </div>

                    {/* Input area */}
                    <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
                        {history.length > 0 && !loading && (
                            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
                                {suggestions.map(s => (
                                    <button key={s} type="button" onClick={() => setPrompt(s)}
                                        style={{ fontSize: 11, padding: '4px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 20, color: '#374151', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}>{s}</button>
                                ))}
                            </div>
                        )}
                        <form onSubmit={handleGenerate}>
                            <div style={{ position: 'relative' }}>
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    placeholder={`Ask ${selectedModel === 'deepseek' ? 'DeepSeek' : 'Gemini'}… describe your project`}
                                    disabled={loading}
                                    rows={3}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(e); } }}
                                    style={{
                                        width: '100%', resize: 'none', border: '1px solid #e5e7eb', borderRadius: 10,
                                        padding: '10px 44px 10px 12px', fontSize: 13, fontFamily: 'inherit',
                                        background: '#fafafa', outline: 'none', lineHeight: 1.5,
                                        boxSizing: 'border-box',
                                    }}
                                />
                                <button type="submit" disabled={loading || !prompt.trim()}
                                    style={{
                                        position: 'absolute', right: 10, bottom: 10,
                                        width: 28, height: 28, border: 'none', borderRadius: '50%',
                                        background: loading || !prompt.trim() ? '#e5e7eb' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        color: loading || !prompt.trim() ? '#999' : 'white',
                                        cursor: loading || !prompt.trim() ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                                    }}>→</button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* ── Center/Right: IDE + Preview ── */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#1e1e1e' }}>
                    {activeTab === 'explorer' ? (
                        <>
                            {/* File explorer sidebar */}
                            <div style={{
                                width: 220, minWidth: 180, background: '#252526', borderRight: '1px solid #3c3c3c',
                                display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
                            }}>
                                <div style={{
                                    padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    borderBottom: '1px solid #3c3c3c',
                                }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#bbbbbb', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Explorer</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => handleNewFile('')} title="New file"
                                            style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>+</button>
                                        <button onClick={() => handleNewFolder('')} title="New folder"
                                            style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>📂</button>
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
                                    {currentFiles.length === 0 ? (
                                        <div style={{ padding: 16, fontSize: 12, color: '#666', textAlign: 'center' }}>No files yet.<br />Generate a project to start.</div>
                                    ) : (
                                        <FileTreeNode
                                            node={fileTree} depth={0}
                                            selectedFile={displaySelectedFile}
                                            onSelect={f => { if (!loading) setSelectedFile(f); }}
                                            onDelete={handleDeleteFile}
                                            onRename={handleRenameFile}
                                            onNewFile={handleNewFile}
                                            onNewFolder={handleNewFolder}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Monaco Editor */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Editor Area */}
                                {(loading && currentFiles.length === 0) ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                                        <span style={{ fontSize: 24, marginBottom: 12 }}>✨</span>
                                        <span>Generating project...</span>
                                    </div>
                                ) : displaySelectedFile ? (
                                    <>
                                        {/* Tab bar */}
                                        <div style={{ background: '#2d2d2d', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'center', height: 35, paddingLeft: 0 }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
                                                height: '100%', borderRight: '1px solid #3c3c3c',
                                                background: '#1e1e1e', borderTop: '1px solid #6366f1',
                                            }}>
                                                <FileIcon name={displaySelectedFile.path.split('/').pop()} />
                                                <span style={{ fontSize: 12, color: '#cccccc' }}>{displaySelectedFile.path.split('/').pop()}</span>
                                            </div>
                                            <span style={{ fontSize: 11, color: '#555', marginLeft: 12 }}>{displaySelectedFile.path}</span>
                                        </div>
                                        {/* Editor */}
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <Editor
                                                height="100%"
                                                language={getMonacoLanguage(displaySelectedFile.path)}
                                                value={displaySelectedFile.content}
                                                onChange={handleCodeChange}
                                                theme="vs-dark"
                                                options={{
                                                    fontSize: 13,
                                                    minimap: { enabled: false },
                                                    scrollBeyondLastLine: false,
                                                    wordWrap: 'on',
                                                    lineNumbers: 'on',
                                                    renderWhitespace: 'selection',
                                                    tabSize: 2,
                                                    padding: { top: 12 },
                                                    readOnly: loading,
                                                    automaticLayout: true,
                                                }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ fontSize: 40 }}>✦</div>
                                        <div style={{ fontSize: 14 }}>{loading ? 'Generating project…' : 'Select a file to edit'}</div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Preview */
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ background: '#2d2d2d', borderBottom: '1px solid #3c3c3c', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {['#ff5f57', '#ffbd2e', '#28c840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                                </div>
                                <div style={{ flex: 1, background: '#1e1e1e', borderRadius: 4, padding: '3px 10px', fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🔒 <span>preview.local/{currentProject?.name || 'project'}</span>
                                </div>
                                <button onClick={() => {
                                    const blob = new Blob([previewHtml], { type: 'text/html' });
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                }} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                                    ↗ Open
                                </button>
                            </div>
                            <iframe
                                style={{ flex: 1, border: 'none', background: '#fff' }}
                                srcDoc={previewHtml}
                                title="Live Preview"
                                sandbox="allow-scripts"
                            />
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40% { transform: translateY(-4px); opacity: 1; }
                }
                .file-ctx-btn { opacity: 0 !important; }
                div:hover > div > .file-ctx-btn { opacity: 1 !important; }
                *::-webkit-scrollbar { width: 5px; height: 5px; }
                *::-webkit-scrollbar-track { background: transparent; }
                *::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
            `}</style>
        </div>
    );
}
