import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, X, ArrowLeft } from 'lucide-react';
import api from '../../api';

export default function SpeakingProfile() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState({
        name: '', age: '', city: '', country: 'Nederland',
        occupation: '', family_description: '', hobbies: '',
        languages: '', study_reason: '', daily_routine: ''
    });
    const [customFields, setCustomFields] = useState([]);
    const [newFieldName, setNewFieldName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/speaking/profile').then(r => {
            if (r.data && r.data.name !== null) setProfile(prev => ({ ...prev, ...r.data }));
        }).catch(console.error);
        api.get('/speaking/profile/custom-fields').then(r => setCustomFields(r.data)).catch(console.error);
    }, []);

    const handleChange = (field, value) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/speaking/profile', profile);
            for (const cf of customFields) {
                await api.post('/speaking/profile/custom-fields', cf);
            }
            navigate('/speaking');
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const addCustomField = () => {
        if (!newFieldName.trim()) return;
        setCustomFields(prev => [...prev, { field_name: newFieldName.trim(), field_value: '' }]);
        setNewFieldName('');
    };

    const updateCustomField = (idx, value) => {
        setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, field_value: value } : f));
    };

    const removeCustomField = async (idx) => {
        const field = customFields[idx];
        try {
            await api.delete(`/speaking/profile/custom-fields/${encodeURIComponent(field.field_name)}`);
        } catch (e) { /* may not exist yet */ }
        setCustomFields(prev => prev.filter((_, i) => i !== idx));
    };

    const fields = [
        { key: 'name', label: 'Your Name', placeholder: 'e.g. Rahul' },
        { key: 'age', label: 'Age', placeholder: 'e.g. 30' },
        { key: 'city', label: 'City', placeholder: 'e.g. Amsterdam' },
        { key: 'country', label: 'Country of Origin', placeholder: 'e.g. India' },
        { key: 'occupation', label: 'Occupation', placeholder: 'e.g. Software Developer' },
        { key: 'family_description', label: 'Family', placeholder: 'e.g. Married, two children' },
        { key: 'hobbies', label: 'Hobbies', placeholder: 'e.g. Reading, cooking, cycling' },
        { key: 'languages', label: 'Languages Spoken', placeholder: 'e.g. English, Hindi, Dutch (learning)' },
        { key: 'study_reason', label: 'Why Learning Dutch?', placeholder: 'e.g. Living in the Netherlands, for integration' },
        { key: 'daily_routine', label: 'Daily Routine (brief)', placeholder: 'e.g. Work 9-5, cook dinner, study Dutch in evening' },
    ];

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        background: 'var(--bg-dark)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-main)',
        fontFamily: 'inherit',
        fontSize: '0.95rem',
        outline: 'none',
        boxSizing: 'border-box',
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <button
                onClick={() => navigate('/speaking')}
                className="btn btn-outline"
                style={{ marginBottom: '20px', padding: '6px 14px', fontSize: '0.85rem' }}
            >
                <ArrowLeft size={16} />
                Back
            </button>

            <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem' }}>Your Profile</h1>
            <p style={{ margin: '0 0 24px', color: 'var(--text-muted)' }}>
                Your details will be used to personalize speaking exam answers
            </p>

            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'grid', gap: '16px' }}>
                    {fields.map(f => (
                        <div key={f.key}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {f.label}
                            </label>
                            <input
                                style={inputStyle}
                                value={profile[f.key] || ''}
                                onChange={e => handleChange(f.key, e.target.value)}
                                placeholder={f.placeholder}
                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom Fields */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Custom Fields</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Add any extra details that might be useful for your speaking answers
                </p>

                {customFields.map((cf, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                        <span style={{ minWidth: '120px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {cf.field_name}
                        </span>
                        <input
                            style={{ ...inputStyle, flex: 1 }}
                            value={cf.field_value}
                            onChange={e => updateCustomField(idx, e.target.value)}
                            placeholder={`Value for ${cf.field_name}`}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                        <button
                            onClick={() => removeCustomField(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '4px' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                ))}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={newFieldName}
                        onChange={e => setNewFieldName(e.target.value)}
                        placeholder="New field name (e.g. Favorite Dutch city)"
                        onKeyDown={e => e.key === 'Enter' && addCustomField()}
                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                    />
                    <button className="btn btn-outline" onClick={addCustomField} style={{ padding: '8px 14px' }}>
                        <Plus size={16} />
                        Add
                    </button>
                </div>
            </div>

            {/* Save */}
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
            >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Profile'}
            </button>
        </div>
    );
}
