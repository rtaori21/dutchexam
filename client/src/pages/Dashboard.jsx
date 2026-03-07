import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Zap, CheckCircle, BookOpen, Layers } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>{label}</h3>
                <Icon size={24} color={color} />
            </div>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>{value}</p>
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get('/progress/stats')
            .then(res => setStats(res.data))
            .catch(err => console.error(err));
    }, []);

    if (!stats) return <div className="container" style={{ marginTop: 50 }}>Loading stats...</div>;

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>Welkom terug!</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Ready to master your Dutch vocabulary?</p>
            </header>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px',
                marginBottom: '40px'
            }}>
                <StatCard icon={BookOpen} label="Total Words" value={stats.total} color="#6366f1" />
                <StatCard icon={CheckCircle} label="Mastered" value={stats.mastered} color="#10b981" />
                <StatCard icon={Layers} label="Learning" value={stats.learning} color="#f59e0b" />
                <StatCard icon={Zap} label="New Words" value={stats.new_words} color="#f472b6" />
            </div>

            <div style={{ textAlign: 'center' }}>
                <Link to="/practice" className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '1.2rem' }}>
                    <Zap size={24} />
                    Start Daily Practice
                </Link>
            </div>
        </div>
    );
}
