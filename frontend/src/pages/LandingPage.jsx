import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    const isLoggedIn = !!localStorage.getItem('token');

    return (
        <div className="landing-page">
            {/* ── Navigation ── */}
            <nav className="landing-nav">
                <div className="landing-logo">
                    <span className="landing-logo-icon">✨</span>
                    <span className="landing-logo-text">Nickxor</span>
                </div>
                <div className="landing-links hidden-mobile">
                    <a href="#features">Features</a>
                    <a href="#how-it-works">How it Works</a>
                    <a href="#pricing">Pricing</a>
                </div>
                <div className="landing-nav-actions">
                    {isLoggedIn ? (
                        <button className="btn-primary" onClick={() => navigate('/chat')}>
                            Open App →
                        </button>
                    ) : (
                        <>
                            <button className="btn-text hidden-mobile" onClick={() => navigate('/auth')}>Log in</button>
                            <button className="btn-primary" onClick={() => navigate('/auth')}>Get Started</button>
                        </>
                    )}
                </div>
            </nav>

            {/* ── Hero Section (Split Layout) ── */}
            <header className="hero-advanced">
                <div className="hero-orb hero-orb-blue" />
                <div className="hero-orb hero-orb-purple" />

                <div className="hero-grid">
                    <div className="hero-text-content">
                        <div className="hero-badge-glass">
                            <span className="badge-sparkle">✨</span> Gemini 2.5 Flash-Lite Integration Live
                        </div>
                        <h1 className="hero-title-max">
                            Ship code faster with <br /> your brilliant <br />
                            <span className="text-gradient">AI Co-Worker.</span>
                        </h1>
                        <p className="hero-subtitle-large">
                            Experience zero-latency streaming, auto-formatting, and intelligent context retention. Stop writing boilerplate and start building products.
                        </p>
                        <div className="hero-cta-group">
                            <button className="btn-primary btn-xl" onClick={() => navigate(isLoggedIn ? '/chat' : '/auth')}>
                                {isLoggedIn ? 'Continue Building' : 'Start for Free'}
                            </button>
                            <button className="btn-secondary btn-xl" onClick={() => {
                                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                            }}>
                                View Features
                            </button>
                        </div>
                        <div className="hero-social-proof">
                            ⭐ Join 10,000+ developers shipping 10x faster
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="glass-panel main-mockup">
                            <div className="mockup-header-mac">
                                <span className="mac-btn red" />
                                <span className="mac-btn yellow" />
                                <span className="mac-btn green" />
                            </div>
                            <div className="mockup-chat">
                                <div className="chat-bubble user">Write a sorting algorithm in Python</div>
                                <div className="chat-bubble agent">
                                    <p>Here's a highly optimized quicksort implementation:</p>
                                    <div className="mockup-code-block">
                                        <div className="code-head"><span>python</span><span>&#x2398; Copy</span></div>
                                        <pre><code>{`def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)`}</code></pre>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating decorative elements */}
                        <div className="glass-panel floating-stat stats-1">
                            <div className="stat-icon">⚡</div>
                            <div className="stat-text">
                                <strong>12ms</strong>
                                <span>Time to First Token</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Trusted By Logo Strip ── */}
            <section className="trusted-by">
                <p>POWERING NEXT-GENERATION ENGINEERING TEAMS AT</p>
                <div className="logo-strip">
                    <span className="fake-logo">Acme Corp</span>
                    <span className="fake-logo">Globex</span>
                    <span className="fake-logo">Soylent</span>
                    <span className="fake-logo">Initech</span>
                    <span className="fake-logo">Umbrella Corp</span>
                    <span className="fake-logo">Stark Ind.</span>
                </div>
            </section>

            {/* ── Feature Highlights (Alternating Rows) ── */}
            <section id="features" className="showcase-section">
                <div className="showcase-row">
                    <div className="showcase-text">
                        <div className="showcase-label">RETHINK SPEED</div>
                        <h2>Blazing Fast Token Streaming</h2>
                        <p>We've engineered our backend to perfectly proxy the Gemini streaming API directly to your browser. You read the answer exactly as fast as the AI forms the thought.</p>
                        <ul className="showcase-list">
                            <li>✓ Zero-latency unbuffered chunks</li>
                            <li>✓ Built-in SSE (Server-Sent Events)</li>
                            <li>✓ Fallback handling for network drops</li>
                        </ul>
                    </div>
                    <div className="showcase-visual">
                        <div className="visual-box gradient-bg">
                            <div className="stream-demo">
                                <span>I</span>
                                <span> a</span>
                                <span>m</span>
                                <span> t</span>
                                <span>h</span>
                                <span>i</span>
                                <span>n</span>
                                <span>k</span>
                                <span>i</span>
                                <span>n</span>
                                <span>g</span>
                                <span className="cursor-blink" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="showcase-row reverse">
                    <div className="showcase-text">
                        <div className="showcase-label">BEAUTIFUL UX</div>
                        <h2>VS-Code Grade Syntax Highlighting</h2>
                        <p>Your code shouldn't look like a plain text document. We parse all AI output to render stunning, fully colorized, syntax-highlighted code blocks with 1-click copy functionality.</p>
                        <ul className="showcase-list">
                            <li>✓ Supports 50+ programming languages</li>
                            <li>✓ Automatic language detection</li>
                            <li>✓ Dark and Light theme responsive</li>
                        </ul>
                    </div>
                    <div className="showcase-visual">
                        <div className="visual-box dark-bg">
                            <div className="code-snippet-demo">
                                <span style={{ color: '#c678dd' }}>const</span> <span style={{ color: '#61afef' }}>agent</span> = <span style={{ color: '#c678dd' }}>await</span> <span style={{ color: '#e5c07b' }}>init</span>();<br />
                                <span style={{ color: '#61afef' }}>console</span>.<span style={{ color: '#e5c07b' }}>log</span>(<span style={{ color: '#98c379' }}>"Hello World!"</span>);
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* ── Pricing Section ── */}
            <section id="pricing" className="pricing-section">
                <div className="section-header">
                    <h2>Simple, transparent pricing</h2>
                    <p>Start for free, upgrade when you need to unleash the full power of AI.</p>
                </div>
                <div className="pricing-cards">
                    <div className="price-card">
                        <div className="price-tier">Hobby</div>
                        <div className="price-amount">$0<span>/mo</span></div>
                        <ul className="price-features">
                            <li>✓ 50 messages per day</li>
                            <li>✓ Standard speed</li>
                            <li>✓ Basic code highlighting</li>
                            <li>✗ Admin dashboard access</li>
                        </ul>
                        <button className="btn-secondary w-full" onClick={() => navigate('/auth')}>Start Free</button>
                    </div>
                    <div className="price-card popular">
                        <div className="popular-badge">Most Popular</div>
                        <div className="price-tier">Pro</div>
                        <div className="price-amount">$15<span>/mo</span></div>
                        <ul className="price-features">
                            <li>✓ Unlimited messages</li>
                            <li>✓ Priority API routing</li>
                            <li>✓ Advanced model access</li>
                            <li>✓ Early access to features</li>
                        </ul>
                        <button className="btn-primary w-full" onClick={() => navigate('/auth')}>Upgrade to Pro</button>
                    </div>
                    <div className="price-card">
                        <div className="price-tier">Team</div>
                        <div className="price-amount">$49<span>/mo</span></div>
                        <ul className="price-features">
                            <li>✓ Everything in Pro</li>
                            <li>✓ 5 team members</li>
                            <li>✓ Admin dashboard access</li>
                            <li>✓ Centralized billing</li>
                        </ul>
                        <button className="btn-secondary w-full" onClick={() => navigate('/auth')}>Contact Sales</button>
                    </div>
                </div>
            </section>

            {/* ── Bottom CTA ── */}
            <section className="bottom-cta">
                <div className="cta-container">
                    <h2>Ready to supercharge your workflow?</h2>
                    <p>Join thousands of developers writing better code, faster.</p>
                    <button className="btn-primary btn-xl" onClick={() => navigate(isLoggedIn ? '/chat' : '/auth')}>
                        Get Started in 30 Seconds
                    </button>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer-advanced">
                <div className="footer-grid">
                    <div className="footer-brand">
                        <div className="landing-logo">
                            <span className="landing-logo-icon">✨</span>
                            <span className="landing-logo-text">Nickxor</span>
                        </div>
                        <p>The ultimate AI coding companion for modern engineering teams.</p>
                    </div>
                    <div className="footer-links">
                        <h4>Product</h4>
                        <a href="#features">Features</a>
                        <a href="#pricing">Pricing</a>
                        <a href="#">Changelog</a>
                    </div>
                    <div className="footer-links">
                        <h4>Legal</h4>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                        <a href="#">Cookie Policy</a>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© 2026 Nickxor Inc. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
