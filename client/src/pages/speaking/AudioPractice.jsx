import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, BookOpen, AlertTriangle } from 'lucide-react';
import api from '../../api';
import SpeakButton from '../../components/speaking/SpeakButton';
import AudioRecorder from '../../components/speaking/AudioRecorder';

export default function AudioPractice() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [qas, setQas] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);

    useEffect(() => {
        const url = topicId
            ? `/speaking/qa/${topicId}`
            : '/speaking/progress/review';
        api.get(url).then(r => setQas(r.data)).catch(console.error);
    }, [topicId]);

    const current = qas[currentIndex];

    const goNext = () => {
        if (currentIndex < qas.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setShowAnswer(false);
        }
    };

    const goPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setShowAnswer(false);
        }
    };

    if (qas.length === 0) {
        return (
            <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '80px' }}>
                <CheckCircle size={80} color="var(--success)" style={{ marginBottom: '20px' }} />
                <h1>No questions available</h1>
                <Link to="/speaking" className="btn btn-primary">Back to Speaking</Link>
            </div>
        );
    }

    if (!current) return <div className="container">Loading...</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '650px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button
                    onClick={() => navigate('/speaking')}
                    className="btn btn-outline"
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                    <ArrowLeft size={16} />
                    Back
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {currentIndex + 1} of {qas.length}
                </span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '4px', background: 'var(--bg-card)', borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${((currentIndex + 1) / qas.length) * 100}%`,
                    background: 'linear-gradient(to right, var(--primary), var(--accent))',
                    transition: 'width 0.3s ease'
                }} />
            </div>

            {/* Question */}
            <div className="card" style={{ marginBottom: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                    Question
                </p>
                <h2 style={{ margin: '0 0 4px', fontSize: '1.4rem' }}>
                    {current.question_nl || current.question_en}
                </h2>
                <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {current.question_en}
                </p>
                {current.question_phonetic && (
                    <p style={{ margin: '0 0 12px', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        {current.question_phonetic}
                    </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
                    {current.question_nl && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Listen:</span>
                            <SpeakButton text={current.question_nl} size={22} />
                        </div>
                    )}
                </div>
            </div>

            {/* Record Your Answer */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Your Answer</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Listen to the question, then record your answer in Dutch
                </p>
                <AudioRecorder />
            </div>

            {/* Model Answer (toggle) */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="btn btn-outline"
                    style={{ width: '100%', justifyContent: 'center', marginBottom: showAnswer ? '16px' : 0 }}
                >
                    {showAnswer ? 'Hide Model Answer' : 'Show Model Answer'}
                </button>

                {showAnswer && (
                    <div>
                        {current.answer_nl && (
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent)' }}>
                                        {current.answer_nl}
                                    </p>
                                    <SpeakButton text={current.answer_nl} size={18} />
                                </div>
                                {current.answer_phonetic && (
                                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                        {current.answer_phonetic}
                                    </p>
                                )}
                                <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {current.answer_en}
                                </p>
                            </div>
                        )}

                        {current.grammar_notes && (
                            <div style={{
                                marginBottom: '8px', padding: '10px 12px',
                                background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--primary)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <BookOpen size={12} color="var(--primary)" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>Grammar</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{current.grammar_notes}</p>
                            </div>
                        )}

                        {current.common_mistakes && (
                            <div style={{
                                padding: '10px 12px',
                                background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--warning)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <AlertTriangle size={12} color="var(--warning)" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)' }}>Watch Out</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{current.common_mistakes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button
                    className="btn btn-outline"
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    style={{ flex: 1, justifyContent: 'center', opacity: currentIndex === 0 ? 0.4 : 1 }}
                >
                    <ChevronLeft size={18} />
                    Previous
                </button>
                <button
                    className="btn btn-primary"
                    onClick={goNext}
                    disabled={currentIndex === qas.length - 1}
                    style={{ flex: 1, justifyContent: 'center', opacity: currentIndex === qas.length - 1 ? 0.4 : 1 }}
                >
                    Next
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
