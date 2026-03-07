import React from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

export default function ConfidenceButtons({ onRate }) {
    return (
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
                className="btn"
                style={{ background: 'var(--error)', color: 'white', width: '160px' }}
                onClick={() => onRate(1)}
            >
                <ThumbsDown size={18} />
                Needs Practice
            </button>
            <button
                className="btn"
                style={{ background: 'var(--success)', color: 'white', width: '160px' }}
                onClick={() => onRate(2)}
            >
                <ThumbsUp size={18} />
                Good
            </button>
        </div>
    );
}
