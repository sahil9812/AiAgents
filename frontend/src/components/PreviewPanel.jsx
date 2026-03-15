import { useState, useRef, useEffect } from 'react';
import { buildPreviewHtml, extractCodeBlocks } from '../utils/codeExtractor';

export default function PreviewPanel({ markdown, onClose }) {
    const [activeTab, setActiveTab] = useState('preview');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const iframeRef = useRef(null);

    const blocks = extractCodeBlocks(markdown);
    const previewHtml = buildPreviewHtml(markdown);

    function handleRefresh() {
        setIsRefreshing(true);
        if (iframeRef.current) {
            iframeRef.current.srcdoc = '';
            setTimeout(() => {
                iframeRef.current.srcdoc = previewHtml;
                setIsRefreshing(false);
            }, 100);
        }
    }

    function handleOpenExternal() {
        const blob = new Blob([previewHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    function handleCopyCode(code) {
        navigator.clipboard.writeText(code).catch(() => { });
    }

    const tabs = [
        { id: 'preview', label: '▶ Preview' },
        blocks.html && { id: 'html', label: 'HTML' },
        blocks.css && { id: 'css', label: 'CSS' },
        blocks.js && { id: 'js', label: 'JS' },
    ].filter(Boolean);

    return (
        <div className="preview-panel">
            {/* Header */}
            <div className="preview-header">
                <div className="preview-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`preview-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="preview-actions">
                    <button className="preview-action-btn" onClick={handleRefresh} title="Refresh preview">🔄</button>
                    <button className="preview-action-btn" onClick={handleOpenExternal} title="Open in new tab">↗</button>
                    <button className="preview-action-btn preview-close-btn" onClick={onClose} title="Close preview">✕</button>
                </div>
            </div>

            {/* Content */}
            <div className="preview-content">
                {activeTab === 'preview' && (
                    <div className="preview-iframe-wrapper">
                        {isRefreshing ? (
                            <div className="preview-loading">
                                <div className="preview-spinner" />
                                <span>Refreshing…</span>
                            </div>
                        ) : (
                            <iframe
                                ref={iframeRef}
                                className="preview-iframe"
                                srcDoc={previewHtml}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                title="Live Preview"
                            />
                        )}
                    </div>
                )}

                {activeTab !== 'preview' && (
                    <div className="preview-code-view">
                        <div className="preview-code-toolbar">
                            <span className="preview-code-lang">{activeTab.toUpperCase()}</span>
                            <button
                                className="btn-copy preview-copy-btn"
                                onClick={() => handleCopyCode(blocks[activeTab])}
                            >
                                📋 Copy
                            </button>
                        </div>
                        <pre className="preview-code-pre">
                            <code>{blocks[activeTab]}</code>
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
