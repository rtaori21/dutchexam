import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, SkipForward, CheckCircle, Eye } from 'lucide-react';
import api from '../../api';
import ChatBubble from '../../components/speaking/ChatBubble';

export default function ConversationPractice() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [qas, setQas] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [showModel, setShowModel] = useState(false);
    const [conversation, setConversation] = useState([]);
    const [complete, setComplete] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        const url = topicId
            ? `/speaking/qa/${topicId}`
            : '/speaking/progress/review';
        api.get(url).then(r => {
            const data = r.data;
            setQas(data);
            if (data.length > 0) {
                setConversation([{
                    type: 'examiner',
                    textEn: data[0].question_en,
                    textNl: data[0].question_nl,
                    phonetic: data[0].question_phonetic
                }]);
            } else {
                setComplete(true);
            }
        }).catch(console.error);
    }, [topicId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);

    const current = qas[currentIndex];

    const submitAnswer = () => {
        if (!current) return;
        setConversation(prev => [
            ...prev,
            { type: 'user', textNl: userAnswer || '(skipped)' }
        ]);
        setUserAnswer('');
        setShowModel(true);
    };

    const revealModel = () => {
        if (!current) return;

        // Record practice
        api.post('/speaking/progress', { qa_id: current.id, confidence: 1 }).catch(console.error);

        setConversation(prev => [
            ...prev,
            {
                type: 'examiner',
                textEn: current.answer_en,
                textNl: current.answer_nl,
                phonetic: current.answer_phonetic,
                grammarNotes: current.grammar_notes,
                commonMistakes: current.common_mistakes,
                isModelAnswer: true
            }
        ]);
        setShowModel(false);

        // Move to next question
        const nextIdx = currentIndex + 1;
        if (nextIdx < qas.length) {
            setCurrentIndex(nextIdx);
            setTimeout(() => {
                setConversation(prev => [
                    ...prev,
                    {
                        type: 'examiner',
                        textEn: qas[nextIdx].question_en,
                        textNl: qas[nextIdx].question_nl,
                        phonetic: qas[nextIdx].question_phonetic
                    }
                ]);
            }, 500);
        } else {
            setComplete(true);
        }
    };

    if (complete && conversation.length === 0) {
        return (
            <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '80px' }}>
                <CheckCircle size={80} color="var(--success)" style={{ marginBottom: '20px' }} />
                <h1>No questions available</h1>
                <Link to="/speaking" className="btn btn-primary">Back to Speaking</Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
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
                    Question {Math.min(currentIndex + 1, qas.length)} of {qas.length}
                </span>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {conversation.map((msg, idx) => (
                    <div key={idx}>
                        {msg.isModelAnswer && (
                            <p style={{
                                textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)',
                                margin: '8px 0', textTransform: 'uppercase', letterSpacing: '1px'
                            }}>
                                Model Answer
                            </p>
                        )}
                        <ChatBubble {...msg} />
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            {!complete && (
                <div style={{
                    padding: '16px 0',
                    borderTop: '1px solid var(--glass-border)',
                }}>
                    {showModel ? (
                        <button
                            className="btn btn-primary"
                            onClick={revealModel}
                            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
                        >
                            <Eye size={18} />
                            Show Model Answer & Next
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                value={userAnswer}
                                onChange={e => setUserAnswer(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                                placeholder="Type your Dutch answer here..."
                                style={{
                                    flex: 1, padding: '12px 16px',
                                    background: 'var(--bg-dark)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-main)',
                                    fontFamily: 'inherit', fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                                autoFocus
                            />
                            <button className="btn btn-primary" onClick={submitAnswer} style={{ padding: '12px 16px' }}>
                                <Send size={18} />
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={() => { setUserAnswer(''); submitAnswer(); }}
                                title="Skip"
                                style={{ padding: '12px' }}
                            >
                                <SkipForward size={18} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {complete && conversation.length > 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '12px' }} />
                    <h2 style={{ margin: '0 0 8px' }}>Conversation Complete!</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                        You practiced {qas.length} questions
                    </p>
                    <Link to="/speaking" className="btn btn-primary">Back to Speaking</Link>
                </div>
            )}
        </div>
    );
}
