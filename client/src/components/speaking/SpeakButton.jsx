import React from 'react';
import { Volume2 } from 'lucide-react';

export default function SpeakButton({ text, lang = 'nl-NL', size = 18, style = {} }) {
    const speak = (e) => {
        e.stopPropagation();
        if (!text) return;
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = lang;
        msg.rate = 0.85;
        window.speechSynthesis.speak(msg);
    };

    return (
        <button
            onClick={speak}
            title="Listen"
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--primary)',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                ...style
            }}
        >
            <Volume2 size={size} />
        </button>
    );
}
