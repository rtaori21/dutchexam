import React from 'react';
import SpeakButton from './SpeakButton';

export default function ChatBubble({ type, textEn, textNl, phonetic, grammarNotes, commonMistakes }) {
    const isExaminer = type === 'examiner';

    return (
        <div style={{
            display: 'flex',
            justifyContent: isExaminer ? 'flex-start' : 'flex-end',
            marginBottom: '16px'
        }}>
            <div style={{
                maxWidth: '80%',
                padding: '14px 18px',
                borderRadius: '16px',
                borderTopLeftRadius: isExaminer ? '4px' : '16px',
                borderTopRightRadius: isExaminer ? '16px' : '4px',
                background: isExaminer
                    ? 'var(--glass-bg)'
                    : 'linear-gradient(135deg, var(--primary), var(--accent))',
                border: isExaminer ? '1px solid var(--glass-border)' : 'none',
            }}>
                {textNl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: textEn ? '6px' : 0 }}>
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
                            {textNl}
                        </p>
                        <SpeakButton text={textNl} size={14} style={{ color: isExaminer ? 'var(--primary)' : 'white' }} />
                    </div>
                )}
                {textEn && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: isExaminer ? 'var(--text-muted)' : 'rgba(255,255,255,0.8)' }}>
                        {textEn}
                    </p>
                )}
                {phonetic && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: isExaminer ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)' }}>
                        {phonetic}
                    </p>
                )}
                {grammarNotes && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                        Grammar: {grammarNotes}
                    </p>
                )}
                {commonMistakes && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--warning)' }}>
                        Watch out: {commonMistakes}
                    </p>
                )}
            </div>
        </div>
    );
}
