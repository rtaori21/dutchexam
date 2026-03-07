import React, { useEffect, useState } from 'react';
import api from '../api';
import { Volume2, Search, ChevronLeft, ChevronRight, Plus, X, Save } from 'lucide-react';

export default function Dictionary() {
    const [words, setWords] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ dutch: '', english: '', ipa: '', example_dutch: '', example_english: '', category: '' });
    const [saving, setSaving] = useState(false);

    const fetchWords = async () => {
        setLoading(true);
        try {
            const res = await api.get('/words', { params: { page, search, limit: 20 } });
            setWords(res.data.data);
            setTotalPages(res.data.pagination.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchWords, 300);
        return () => clearTimeout(timer);
    }, [page, search]);

    const speak = (text) => {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'nl-NL';
        window.speechSynthesis.speak(msg);
    };

    const handleSave = async () => {
        if (!form.dutch.trim() || !form.english.trim()) return;
        setSaving(true);
        try {
            await api.post('/words', form);
            setForm({ dutch: '', english: '', ipa: '', example_dutch: '', example_english: '', category: '' });
            setShowForm(false);
            fetchWords();
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

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Search Dutch or English..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)',
                            background: 'var(--bg-card)',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                    />
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowForm(!showForm)}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancel' : 'Add Word'}
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Add New Word</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Dutch *</label>
                            <input style={inputStyle} value={form.dutch} onChange={e => setForm({ ...form, dutch: e.target.value })} placeholder="e.g. huis" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>English *</label>
                            <input style={inputStyle} value={form.english} onChange={e => setForm({ ...form, english: e.target.value })} placeholder="e.g. house" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Pronunciation</label>
                            <input style={inputStyle} value={form.ipa} onChange={e => setForm({ ...form, ipa: e.target.value })} placeholder="e.g. hows" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category</label>
                            <input style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. housing" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Example (Dutch)</label>
                            <input style={inputStyle} value={form.example_dutch} onChange={e => setForm({ ...form, example_dutch: e.target.value })} placeholder="e.g. Ik woon in een groot huis" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Example (English)</label>
                            <input style={inputStyle} value={form.example_english} onChange={e => setForm({ ...form, example_english: e.target.value })} placeholder="e.g. I live in a big house" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving || !form.dutch.trim() || !form.english.trim()}
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Word'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {words.map(word => (
                        <div key={word.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{word.dutch}</h3>
                                    {word.ipa && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{word.ipa}</span>}
                                    <button
                                        className="btn-outline"
                                        onClick={() => speak(word.dutch)}
                                        style={{ padding: '6px', borderRadius: '50%', border: 'none' }}
                                    >
                                        <Volume2 size={16} />
                                    </button>
                                </div>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--accent)' }}>{word.english}</p>
                                {word.example_dutch && (
                                    <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        "{word.example_dutch}"
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{
                                    background: word.mastered ? 'var(--success)' : 'var(--bg-dark)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    color: word.mastered ? 'white' : 'var(--text-muted)'
                                }}>
                                    {word.mastered ? 'Mastered' : `Box ${word.box || 0}`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px', alignItems: 'center' }}>
                <button
                    className="btn btn-outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                >
                    <ChevronLeft size={20} />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                    className="btn btn-outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
}
