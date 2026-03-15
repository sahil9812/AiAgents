import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodeBlock({ children, className }) {
    const [copied, setCopied] = useState(false);
    const language = className?.replace('language-', '') || 'text';
    const content = Array.isArray(children) ? children.join('') : String(children || '');

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(content.trimEnd());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback inside catch
        }
    }

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-block-lang">{language}</span>
                <button className="btn-copy" onClick={handleCopy} title="Copy code">
                    {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{ margin: 0, borderRadius: '0 0 var(--radius-sm) var(--radius-sm)', fontSize: '13px', background: '#1e1e1e' }}
            >
                {content.trimEnd()}
            </SyntaxHighlighter>
        </div>
    );
}
