import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mic, MessageSquare, Headphones, Layers } from 'lucide-react';
import api from '../../api';
import TopicCard from '../../components/speaking/TopicCard';

export default function SpeakingHub() {
    const [topics, setTopics] = useState([]);
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get('/speaking/topics').then(r => setTopics(r.data)).catch(console.error);
        api.get('/speaking/profile').then(r => setProfile(r.data)).catch(console.error);
        api.get('/speaking/progress/stats').then(r => setStats(r.data)).catch(console.error);
    }, []);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ margin: '0 0 8px', fontSize: '2rem' }}>
                    Speaking Exam Prep
                </h1>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    Practice Dutch A2 speaking topics with Q&A flashcards, conversations, and audio
                </p>
            </div>

            {/* Profile + Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                {/* Profile Card */}
                <Link to="/speaking/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                        height: '100%'
                    }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                    >
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <User size={24} color="white" />
                        </div>
                        <div>
                            {profile && profile.name ? (
                                <>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{profile.name}</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {[profile.city, profile.occupation].filter(Boolean).join(' | ') || 'Edit your profile'}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Set up your profile</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Add your details to personalize answers
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </Link>

                {/* Stats Card */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {stats?.total || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Questions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--warning)' }}>
                            {stats?.learning || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Learning</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success)' }}>
                            {stats?.mastered || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mastered</div>
                    </div>
                </div>
            </div>

            {/* Quick Practice Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                <Link to="/speaking/practice/flashcard" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    <Layers size={18} />
                    Flashcards
                </Link>
                <Link to="/speaking/practice/conversation" className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
                    <MessageSquare size={18} />
                    Conversation
                </Link>
                <Link to="/speaking/practice/audio" className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
                    <Headphones size={18} />
                    Audio Practice
                </Link>
            </div>

            {/* Topics Grid */}
            <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem' }}>Topics</h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px'
            }}>
                {topics.map(topic => (
                    <TopicCard key={topic.id} topic={topic} />
                ))}
            </div>
        </div>
    );
}
