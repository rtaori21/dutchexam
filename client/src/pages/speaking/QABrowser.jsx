import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Search, Plus, X, Save, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BookOpen, AlertTriangle } from 'lucide-react';
import SpeakButton from '../../components/speaking/SpeakButton';

export default function QABrowser() {
    const [qas, setQas] = useState([]);
    const [topics, setTopics] = useState([]);
    const [search, setSearch] = useState('');
    const [topicFilter, setTopicFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        topic_id: '', question_en: '', question_nl: '', question_phonetic: '',
        answer_en: '', answer_nl: '', answer_phonetic: '',
        grammar_notes: '', common_mistakes: ''
    });

    const fetchQAs = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (search) params.search = search;
            if (topicFilter) params.topicId = topicFilter;
            const res = await api.get('/speaking/qa/all', { params });
            setQas(res.data.data);
            setTopics(res.data.topics);
            setTotalPages(res.data.pagination.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchQAs, 300);
        return () => clearTimeout(timer);
    }, [page, search, topicFilter]);

    const handleSave = async () => {
        if (!form.topic_id || !form.question_en.trim()) return;
        setSaving(true);
        try {
            await api.post('/speaking/qa', form);
            setForm({
                topic_id: '', question_en: '', question_nl: '', question_phonetic: '',
                answer_en: '', answer_nl: '', answer_phonetic: '',
                grammar_notes: '', common_mistakes: ''
            });
            setShowForm(false);
            fetchQAs();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--glass-border)',
        background: 'var(--bg-dark)',
        color: 'white',
        fontSize: '0.9rem'
    };

    const selectStyle = {
        ...inputStyle,
        appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: '32px'
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0 }}>All Questions & Answers</h1>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancel' : 'Add Question'}
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Search questions or answers..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        style={{
                            ...inputStyle,
                            padding: '12px 12px 12px 40px',
                            background: 'var(--bg-card)',
                            fontSize: '1rem'
                        }}
                    />
                </div>
                <select
                    value={topicFilter}
                    onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
                    style={{ ...selectStyle, width: '220px', background: 'var(--bg-card)' }}
                >
                    <option value="">All Categories</option>
                    {topics.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Add New Question</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category *</label>
                            <select style={selectStyle} value={form.topic_id} onChange={e => setForm({ ...form, topic_id: e.target.value })}>
                                <option value="">Select a category...</option>
                                {topics.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Question (English) *</label>
                            <input style={inputStyle} value={form.question_en} onChange={e => setForm({ ...form, question_en: e.target.value })} placeholder="e.g. What is your name?" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Question (Dutch)</label>
                            <input style={inputStyle} value={form.question_nl} onChange={e => setForm({ ...form, question_nl: e.target.value })} placeholder="e.g. Hoe heet je?" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Question Pronunciation</label>
                            <input style={inputStyle} value={form.question_phonetic} onChange={e => setForm({ ...form, question_phonetic: e.target.value })} placeholder="e.g. hoo hayt yuh" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Answer (English)</label>
                            <input style={inputStyle} value={form.answer_en} onChange={e => setForm({ ...form, answer_en: e.target.value })} placeholder="e.g. My name is..." />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Answer (Dutch)</label>
                            <input style={inputStyle} value={form.answer_nl} onChange={e => setForm({ ...form, answer_nl: e.target.value })} placeholder="e.g. Mijn naam is..." />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Answer Pronunciation</label>
                            <input style={inputStyle} value={form.answer_phonetic} onChange={e => setForm({ ...form, answer_phonetic: e.target.value })} placeholder="e.g. mayn nahm is..." />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Grammar Notes</label>
                            <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.grammar_notes} onChange={e => setForm({ ...form, grammar_notes: e.target.value })} placeholder="Grammar tips..." />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Common Mistakes</label>
                            <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.common_mistakes} onChange={e => setForm({ ...form, common_mistakes: e.target.value })} placeholder="Watch out for..." />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving || !form.topic_id || !form.question_en.trim()}
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Question'}
                        </button>
                    </div>
                </div>
            )}

            {/* Q&A List */}
            {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : qas.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                    No questions found. Try a different search or add a new question.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {qas.map(qa => {
                        const isExpanded = expandedId === qa.id;
                        return (
                            <div key={qa.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : qa.id)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                background: 'rgba(99, 102, 241, 0.2)',
                                                color: 'var(--primary)',
                                                fontWeight: 600
                                            }}>
                                                {qa.topic_name}
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '4px 0 0', fontSize: '1.05rem' }}>
                                            {qa.question_en}
                                        </h3>
                                        {qa.question_nl && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>
                                                    {qa.question_nl}
                                                </p>
                                                <SpeakButton text={qa.question_nl} size={14} />
                                            </div>
                                        )}
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                                </div>

                                {isExpanded && (
                                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                                        {qa.question_phonetic && (
                                            <p style={{ margin: '0 0 8px', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                                Pronunciation: {qa.question_phonetic}
                                            </p>
                                        )}

                                        <div style={{ marginTop: '12px' }}>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Answer</p>
                                            {qa.answer_nl && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <p style={{ margin: 0, fontSize: '1rem', color: 'var(--accent)' }}>{qa.answer_nl}</p>
                                                    <SpeakButton text={qa.answer_nl} size={14} />
                                                </div>
                                            )}
                                            {qa.answer_en && (
                                                <p style={{ margin: '2px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{qa.answer_en}</p>
                                            )}
                                            {qa.answer_phonetic && (
                                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                                    Pronunciation: {qa.answer_phonetic}
                                                </p>
                                            )}
                                        </div>

                                        {qa.grammar_notes && (
                                            <div style={{
                                                marginTop: '12px', padding: '8px 12px',
                                                background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)',
                                                borderLeft: '3px solid var(--primary)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                                    <BookOpen size={12} color="var(--primary)" />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>Grammar</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{qa.grammar_notes}</p>
                                            </div>
                                        )}

                                        {qa.common_mistakes && (
                                            <div style={{
                                                marginTop: '8px', padding: '8px 12px',
                                                background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)',
                                                borderLeft: '3px solid var(--warning)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                                    <AlertTriangle size={12} color="var(--warning)" />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)' }}>Watch Out</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{qa.common_mistakes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px', alignItems: 'center' }}>
                    <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft size={20} />
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button className="btn btn-outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
