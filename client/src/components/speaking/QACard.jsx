import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, BookOpen, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpeakButton from './SpeakButton';

export default function QACard({ qa, topicId }) {
    const [expanded, setExpanded] = useState(false);

    const confidenceLabel = (c) => {
        if (c === undefined || c === null) return { text: 'New', color: 'var(--text-muted)' };
        if (c === 0) return { text: 'New', color: 'var(--text-muted)' };
        if (c === 1) return { text: 'Needs Practice', color: 'var(--warning)' };
        if (c === 2) return { text: 'Good', color: 'var(--primary)' };
        return { text: 'Mastered', color: 'var(--success)' };
    };

    const status = confidenceLabel(qa.confidence);

    return (
        <div className="card" style={{ padding: '16px' }}>
            {/* Header */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    gap: '12px'
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>
                        {qa.question_en}
                    </p>
                    {qa.question_nl && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--accent)' }}>
                            {qa.question_nl}
                            <SpeakButton text={qa.question_nl} size={14} />
                        </p>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: status.color,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: `1px solid ${status.color}`,
                    }}>
                        {status.text}
                    </span>
                    {expanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                </div>
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                    {/* Question pronunciation */}
                    {qa.question_phonetic && (
                        <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Pronunciation: {qa.question_phonetic}
                        </p>
                    )}

                    {/* Answer */}
                    <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Answer</h4>
                        {qa.answer_en && (
                            <p style={{ margin: '0 0 4px', fontSize: '0.9rem' }}>
                                {qa.answer_en}
                            </p>
                        )}
                        {qa.answer_nl && (
                            <p style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--accent)' }}>
                                {qa.answer_nl}
                                <SpeakButton text={qa.answer_nl} size={14} />
                            </p>
                        )}
                        {qa.answer_phonetic && (
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Pronunciation: {qa.answer_phonetic}
                            </p>
                        )}
                    </div>

                    {/* Grammar Notes */}
                    {qa.grammar_notes && (
                        <div style={{
                            marginBottom: '12px',
                            padding: '10px 12px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            borderLeft: '3px solid var(--primary)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <BookOpen size={14} color="var(--primary)" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>Grammar</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {qa.grammar_notes}
                            </p>
                        </div>
                    )}

                    {/* Common Mistakes */}
                    {qa.common_mistakes && (
                        <div style={{
                            marginBottom: '12px',
                            padding: '10px 12px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            borderLeft: '3px solid var(--warning)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <AlertTriangle size={14} color="var(--warning)" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)' }}>Common Mistakes</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {qa.common_mistakes}
                            </p>
                        </div>
                    )}

                    {/* Edit button */}
                    <Link
                        to={`/speaking/topic/${topicId}/edit/${qa.id}`}
                        className="btn btn-outline"
                        style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                    >
                        <Edit3 size={14} />
                        Edit Answer
                    </Link>
                </div>
            )}
        </div>
    );
}
