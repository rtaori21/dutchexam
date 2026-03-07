import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, BookOpen, AlertTriangle } from 'lucide-react';
import api from '../../api';
import SpeakButton from '../../components/speaking/SpeakButton';
import ConfidenceButtons from '../../components/speaking/ConfidenceButtons';
import LanguageToggle from '../../components/speaking/LanguageToggle';

export default function FlashcardPractice() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [complete, setComplete] = useState(false);
    const [questionLang, setQuestionLang] = useState('nl');

    useEffect(() => {
        const url = topicId
            ? `/speaking/progress/review?topicId=${topicId}`
            : '/speaking/progress/review';
        api.get(url).then(r => {
            setQueue(r.data);
            if (r.data.length === 0) setComplete(true);
        }).catch(console.error);
    }, [topicId]);

    const current = queue[currentIndex];

    const handleRate = async (confidence) => {
        if (!current) return;
        try {
            await api.post('/speaking/progress', { qa_id: current.id, confidence });
            if (currentIndex < queue.length - 1) {
                setFlipped(false);
                setTimeout(() => setCurrentIndex(currentIndex + 1), 200);
            } else {
                setComplete(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (complete) {
        return (
            <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '80px' }}>
                <CheckCircle size={80} color="var(--success)" style={{ marginBottom: '20px' }} />
                <h1>All caught up!</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                    You've reviewed all due questions. Come back later for more practice.
                </p>
                <Link to="/speaking" className="btn btn-primary">Back to Speaking</Link>
            </div>
        );
    }

    if (!current) return <div className="container">Loading cards...</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button
                    onClick={() => navigate('/speaking')}
                    className="btn btn-outline"
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                    <ArrowLeft size={16} />
                    Back
                </button>
                <LanguageToggle value={questionLang} onChange={setQuestionLang} />
            </div>

            {/* Progress Bar */}
            <div style={{ height: '4px', background: 'var(--bg-card)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${(currentIndex / queue.length) * 100}%`,
                    background: 'linear-gradient(to right, var(--primary), var(--accent))',
                    transition: 'width 0.3s ease'
                }} />
            </div>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                {currentIndex + 1} of {queue.length}
            </p>

            {/* The Card */}
            <div
                onClick={() => setFlipped(!flipped)}
                style={{ perspective: '1000px', height: '420px', cursor: 'pointer' }}
            >
                <div style={{
                    position: 'relative', width: '100%', height: '100%',
                    transition: 'transform 0.6s', transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}>
                    {/* Front - Question */}
                    <div className="card" style={{
                        position: 'absolute', width: '100%', height: '100%',
                        backfaceVisibility: 'hidden',
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center', alignItems: 'center',
                        border: '2px solid var(--primary)', boxSizing: 'border-box',
                        textAlign: 'center', padding: '32px'
                    }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Question
                        </p>
                        <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', lineHeight: 1.3 }}>
                            {questionLang === 'nl' ? current.question_nl : current.question_en}
                        </h2>
                        {questionLang === 'nl' && current.question_nl && (
                            <SpeakButton text={current.question_nl} size={28} />
                        )}
                        {questionLang === 'nl' && current.question_phonetic && (
                            <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                {current.question_phonetic}
                            </p>
                        )}
                        <p style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Think of your answer, then tap to reveal
                        </p>
                    </div>

                    {/* Back - Answer */}
                    <div className="card" style={{
                        position: 'absolute', width: '100%', height: '100%',
                        backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center', alignItems: 'center',
                        background: 'var(--bg-card)', textAlign: 'center',
                        padding: '24px', boxSizing: 'border-box', overflow: 'auto'
                    }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Model Answer
                        </p>

                        {current.answer_nl && (
                            <div style={{ marginBottom: '8px' }}>
                                <p style={{ fontSize: '1.3rem', color: 'var(--accent)', margin: '0 0 4px', lineHeight: 1.4 }}>
                                    {current.answer_nl}
                                    <SpeakButton text={current.answer_nl} size={18} />
                                </p>
                                {current.answer_phonetic && (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                                        {current.answer_phonetic}
                                    </p>
                                )}
                            </div>
                        )}

                        {current.answer_en && (
                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: '8px 0' }}>
                                {current.answer_en}
                            </p>
                        )}

                        {current.grammar_notes && (
                            <div style={{
                                marginTop: '12px', padding: '8px 12px', width: '100%',
                                background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--primary)', textAlign: 'left'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <BookOpen size={12} color="var(--primary)" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>Grammar</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {current.grammar_notes}
                                </p>
                            </div>
                        )}

                        {current.common_mistakes && (
                            <div style={{
                                marginTop: '8px', padding: '8px 12px', width: '100%',
                                background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--warning)', textAlign: 'left'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <AlertTriangle size={12} color="var(--warning)" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)' }}>Watch Out</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {current.common_mistakes}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rating Buttons */}
            <div style={{ marginTop: '24px', visibility: flipped ? 'visible' : 'hidden' }}>
                <ConfidenceButtons onRate={handleRate} />
            </div>
        </div>
    );
}
