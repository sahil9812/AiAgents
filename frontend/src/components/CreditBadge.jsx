export default function CreditBadge({ credits, maxCredits = 20 }) {
    const isUnlimited = credits === 'Unlimited';
    const isLow = !isUnlimited && credits <= 5;
    const pct = isUnlimited ? 100 : Math.max(0, Math.min(100, (credits / maxCredits) * 100));

    return (
        <div className={`credit-badge ${isLow ? 'low' : ''}`}>
            <div className="credit-badge-circle" style={{ '--pct': pct + '%' }}></div>
            <div className="credit-badge-text">
                <div className="credit-badge-label">Credits Remaining</div>
                <div className="credit-badge-value" style={isUnlimited ? { fontSize: '1.4rem', lineHeight: '1' } : {}}>
                    {isUnlimited ? '∞' : credits}
                </div>
            </div>
        </div>
    );
}
