import React, { useState, useRef } from 'react';
import { Mic, Square, Play, RotateCw } from 'lucide-react';

export default function AudioRecorder() {
    const [recording, setRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const mediaRecorder = useRef(null);
    const chunks = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            chunks.current = [];

            mediaRecorder.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = () => {
                const blob = new Blob(chunks.current, { type: 'audio/webm' });
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorder.current.start();
            setRecording(true);
        } catch (err) {
            console.error('Microphone access denied:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && recording) {
            mediaRecorder.current.stop();
            setRecording(false);
        }
    };

    const reset = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!recording && !audioUrl && (
                <button
                    className="btn btn-outline"
                    onClick={startRecording}
                    style={{ gap: '6px' }}
                >
                    <Mic size={18} color="var(--error)" />
                    Record
                </button>
            )}

            {recording && (
                <button
                    className="btn"
                    onClick={stopRecording}
                    style={{ background: 'var(--error)', color: 'white', gap: '6px' }}
                >
                    <Square size={16} />
                    Stop
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'white',
                        animation: 'pulse 1s infinite'
                    }} />
                </button>
            )}

            {audioUrl && (
                <>
                    <audio controls src={audioUrl} style={{ height: 36 }} />
                    <button
                        className="btn btn-outline"
                        onClick={reset}
                        style={{ padding: '8px' }}
                        title="Re-record"
                    >
                        <RotateCw size={16} />
                    </button>
                </>
            )}
        </div>
    );
}
