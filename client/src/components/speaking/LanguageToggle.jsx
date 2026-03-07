import React from 'react';

export default function LanguageToggle({ value, onChange }) {
    return (
        <div style={{
            display: 'inline-flex',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--glass-border)'
        }}>
            <button
                onClick={() => onChange('en')}
                style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: value === 'en' ? 'var(--primary)' : 'transparent',
                    color: value === 'en' ? 'white' : 'var(--text-muted)',
                    fontFamily: 'inherit'
                }}
            >
                EN
            </button>
            <button
                onClick={() => onChange('nl')}
                style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: value === 'nl' ? 'var(--primary)' : 'transparent',
                    color: value === 'nl' ? 'white' : 'var(--text-muted)',
                    fontFamily: 'inherit'
                }}
            >
                NL
            </button>
        </div>
    );
}
