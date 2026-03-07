import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, MessageSquare, Headphones, Plus } from 'lucide-react';
import api from '../../api';
import QACard from '../../components/speaking/QACard';

export default function TopicDetail() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [qas, setQas] = useState([]);

    useEffect(() => {
        api.get(`/speaking/topics/${topicId}`).then(r => setTopic(r.data)).catch(console.error);
        api.get(`/speaking/qa/${topicId}`).then(r => setQas(r.data)).catch(console.error);
    }, [topicId]);

    if (!topic) return <div className="container">Loading...</div>;

    const practiced = qas.filter(q => q.confidence && q.confidence > 0).length;

    return (
        <div className="animate-fade-in">
            <button
                onClick={() => navigate('/speaking')}
                className="btn btn-outline"
                style={{ marginBottom: '20px', padding: '6px 14px', fontSize: '0.85rem' }}
            >
                <ArrowLeft size={16} />
                Back to Topics
            </button>

            {/* Topic Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem' }}>{topic.name}</h1>
                {topic.description && (
                    <p style={{ margin: '0 0 16px', color: 'var(--text-muted)' }}>{topic.description}</p>
                )}

                {/* Progress Bar */}
                {qas.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {practiced} of {qas.length} practiced
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {Math.round((practiced / qas.length) * 100)}%
                            </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${(practiced / qas.length) * 100}%`,
                                background: 'linear-gradient(to right, var(--primary), var(--accent))',
                                transition: 'width 0.3s ease',
                                borderRadius: '3px'
                            }} />
                        </div>
                    </div>
                )}

                {/* Practice Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Link to={`/speaking/practice/flashcard/${topicId}`} className="btn btn-primary" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
                        <Layers size={16} />
                        Flashcards
                    </Link>
                    <Link to={`/speaking/practice/conversation/${topicId}`} className="btn btn-outline" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
                        <MessageSquare size={16} />
                        Conversation
                    </Link>
                    <Link to={`/speaking/practice/audio/${topicId}`} className="btn btn-outline" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
                        <Headphones size={16} />
                        Audio
                    </Link>
                </div>
            </div>

            {/* Q&A List */}
            <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
                Questions ({qas.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {qas.map(qa => (
                    <QACard key={qa.id} qa={qa} topicId={topicId} />
                ))}
            </div>

            {qas.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                        No questions yet for this topic
                    </p>
                    <Link
                        to={`/speaking/topic/${topicId}/edit/new`}
                        className="btn btn-primary"
                    >
                        <Plus size={16} />
                        Add First Question
                    </Link>
                </div>
            )}
        </div>
    );
}
