import React, { useEffect, useState } from 'react';
import api from '../api';
import { Volume2, RotateCw, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Flashcards() {
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [complete, setComplete] = useState(false);

    useEffect(() => {
        api.get('/words/review')
            .then(res => {
                setQueue(res.data);
                if (res.data.length === 0) setComplete(true);
            })
            .catch(err => console.error(err));
    }, []);

    const currentWord = queue[currentIndex];

    const speak = (e) => {
        e.stopPropagation();
        if (!currentWord) return;
        const msg = new SpeechSynthesisUtterance(currentWord.dutch);
        msg.lang = 'nl-NL';
        window.speechSynthesis.speak(msg);
    };

    const speakSentence = (e) => {
        e.stopPropagation();
        if (!currentWord || !currentWord.example_dutch) return;
        const msg = new SpeechSynthesisUtterance(currentWord.example_dutch);
        msg.lang = 'nl-NL';
        window.speechSynthesis.speak(msg);
    };

    const handleResponse = async (correct) => {
        if (!currentWord) return;

        try {
            await api.post('/progress', { wordId: currentWord.id, correct });

            // Move to next
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
            <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '100px' }}>
                <CheckCircle size={80} color="var(--success)" style={{ marginBottom: '20px' }} />
                <h1>All caught up!</h1>
                <p style={{ color: 'var(--text-muted)' }}>You've reviewed all your due words for now.</p>
                <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
            </div>
        );
    }

    if (!currentWord) return <div className="container">Loading cards...</div>;

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '600px', marginTop: '40px' }}>

            {/* Progress Bar */}
            <div style={{ height: '4px', background: 'var(--bg-card)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${((currentIndex) / queue.length) * 100}%`,
                    background: 'var(--primary)',
                    transition: 'width 0.3s ease'
                }} />
            </div>

            {/* The Card */}
            <div
                onClick={() => setFlipped(!flipped)}
                style={{
                    perspective: '1000px',
                    height: '400px',
                    cursor: 'pointer'
                }}
            >
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    transition: 'transform 0.6s',
                    transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}>

                    {/* Front */}
                    <div className="card" style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        border: '2px solid var(--primary)'
                    }}>
                        <h2 style={{ fontSize: '3rem', marginBottom: '10px' }}>{currentWord.dutch}</h2>

                        <button
                            className="btn-outline"
                            onClick={speak}
                            style={{ marginTop: '20px', padding: '10px', borderRadius: '50%' }}
                        >
                            <Volume2 size={32} />
                        </button>
                        <p style={{ marginTop: '20px', color: 'var(--text-muted)' }}>Tap to reveal</p>
                    </div>

                    {/* Back */}
                    <div className="card" style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'var(--bg-card)'
                    }}>
                        <h2 style={{ fontSize: '2rem', color: 'var(--accent)' }}>{currentWord.english}</h2>

                        {currentWord.example_dutch && (
                            <div style={{ marginTop: '30px', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.2rem', fontStyle: 'italic', marginBottom: '4px' }}>
                                    "{currentWord.example_dutch}"
                                    <button onClick={speakSentence} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '8px', verticalAlign: 'middle', color: 'var(--primary)' }}>
                                        <Volume2 size={16} />
                                    </button>
                                </p>
                                <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>"{currentWord.example_english}"</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '30px', justifyContent: 'center', visibility: flipped ? 'visible' : 'hidden' }}>
                <button
                    className="btn"
                    style={{ background: 'var(--error)', color: 'white', width: '150px' }}
                    onClick={() => handleResponse(false)}
                >
                    <ThumbsDown size={20} />
                    Incorrect
                </button>
                <button
                    className="btn"
                    style={{ background: 'var(--success)', color: 'white', width: '150px' }}
                    onClick={() => handleResponse(true)}
                >
                    <ThumbsUp size={20} />
                    Correct
                </button>
            </div>

        </div>
    );
}
