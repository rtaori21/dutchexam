import React from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import ProgressRing from './ProgressRing';

export default function TopicCard({ topic }) {
    const IconComponent = Icons[topic.icon] || Icons.MessageCircle;
    const practiced = topic.practiced || 0;
    const total = topic.total_qa || 0;

    return (
        <Link
            to={`/speaking/topic/${topic.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
        >
            <div className="card" style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}
                onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <IconComponent size={20} color="white" />
                    </div>
                    {total > 0 && <ProgressRing practiced={practiced} total={total} />}
                </div>

                <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{topic.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {topic.description || (total > 0 ? `${total} questions` : 'No questions yet')}
                    </p>
                </div>

                {total > 0 && (
                    <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {practiced} of {total} practiced
                        {topic.mastered > 0 && ` | ${topic.mastered} mastered`}
                    </div>
                )}
            </div>
        </Link>
    );
}
