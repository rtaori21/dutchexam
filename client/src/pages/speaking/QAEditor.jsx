import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../api';
import SpeakButton from '../../components/speaking/SpeakButton';

export default function QAEditor() {
    const { topicId, qaId } = useParams();
    const navigate = useNavigate();
    const isNew = qaId === 'new';
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        question_en: '', question_nl: '', question_phonetic: '',
        answer_en: '', answer_nl: '', answer_phonetic: '',
        grammar_notes: '', common_mistakes: ''
    });

    useEffect(() => {
        if (!isNew) {
            api.get(`/speaking/qa/item/${qaId}`).then(r => {
                setForm({
                    question_en: r.data.question_en || '',
                    question_nl: r.data.question_nl || '',
                    question_phonetic: r.data.question_phonetic || '',
                    answer_en: r.data.answer_en || '',
                    answer_nl: r.data.answer_nl || '',
                    answer_phonetic: r.data.answer_phonetic || '',
                    grammar_notes: r.data.grammar_notes || '',
                    common_mistakes: r.data.common_mistakes || '',
                });
            }).catch(console.error);
        }
    }, [qaId, isNew]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await api.post('/speaking/qa', { topic_id: parseInt(topicId), ...form });
            } else {
                await api.put(`/speaking/qa/${qaId}`, form);
            }
            navigate(`/speaking/topic/${topicId}`);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        background: 'var(--bg-dark)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-main)',
        fontFamily: 'inherit',
        fontSize: '0.95rem',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const textareaStyle = {
        ...inputStyle,
        minHeight: '80px',
        resize: 'vertical',
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '6px',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--text-muted)'
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <button
                onClick={() => navigate(`/speaking/topic/${topicId}`)}
                className="btn btn-outline"
                style={{ marginBottom: '20px', padding: '6px 14px', fontSize: '0.85rem' }}
            >
                <ArrowLeft size={16} />
                Back to Topic
            </button>

            <h1 style={{ margin: '0 0 24px', fontSize: '1.5rem' }}>
                {isNew ? 'Add New Question' : 'Edit Q&A'}
            </h1>

            {/* Question Section */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: 'var(--primary)' }}>Question</h3>
                <div style={{ display: 'grid', gap: '14px' }}>
                    <div>
                        <label style={labelStyle}>English</label>
                        <input
                            style={inputStyle}
                            value={form.question_en}
                            onChange={e => handleChange('question_en', e.target.value)}
                            placeholder="What is your name?"
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>
                            Dutch
                            {form.question_nl && <SpeakButton text={form.question_nl} size={14} />}
                        </label>
                        <input
                            style={inputStyle}
                            value={form.question_nl}
                            onChange={e => handleChange('question_nl', e.target.value)}
                            placeholder="Hoe heet je?"
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Pronunciation</label>
                        <input
                            style={inputStyle}
                            value={form.question_phonetic}
                            onChange={e => handleChange('question_phonetic', e.target.value)}
                            placeholder="hoo hayt yuh"
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                </div>
            </div>

            {/* Answer Section */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: 'var(--accent)' }}>Answer</h3>
                <div style={{ display: 'grid', gap: '14px' }}>
                    <div>
                        <label style={labelStyle}>English</label>
                        <textarea
                            style={textareaStyle}
                            value={form.answer_en}
                            onChange={e => handleChange('answer_en', e.target.value)}
                            placeholder="My name is Rahul. I am 30 years old."
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>
                            Dutch
                            {form.answer_nl && <SpeakButton text={form.answer_nl} size={14} />}
                        </label>
                        <textarea
                            style={textareaStyle}
                            value={form.answer_nl}
                            onChange={e => handleChange('answer_nl', e.target.value)}
                            placeholder="Mijn naam is Rahul. Ik ben 30 jaar oud."
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Pronunciation</label>
                        <textarea
                            style={textareaStyle}
                            value={form.answer_phonetic}
                            onChange={e => handleChange('answer_phonetic', e.target.value)}
                            placeholder="mayn nahm is Rahul. ik ben der-tikh yahr owt."
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                </div>
            </div>

            {/* Learning Aids Section */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Learning Aids</h3>
                <div style={{ display: 'grid', gap: '14px' }}>
                    <div>
                        <label style={labelStyle}>Grammar Notes</label>
                        <textarea
                            style={textareaStyle}
                            value={form.grammar_notes}
                            onChange={e => handleChange('grammar_notes', e.target.value)}
                            placeholder="Key grammar explanation for this answer..."
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Common Mistakes</label>
                        <textarea
                            style={textareaStyle}
                            value={form.common_mistakes}
                            onChange={e => handleChange('common_mistakes', e.target.value)}
                            placeholder="Typical errors learners make..."
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                </div>
            </div>

            {/* Save */}
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.question_en.trim()}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
            >
                <Save size={18} />
                {saving ? 'Saving...' : isNew ? 'Create Question' : 'Save Changes'}
            </button>
        </div>
    );
}
