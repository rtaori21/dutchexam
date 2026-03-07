const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/speaking/profile
router.get('/', (req, res) => {
    try {
        const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
        res.json(profile || {
            id: 1,
            name: null,
            age: null,
            city: null,
            country: 'Nederland',
            occupation: null,
            family_description: null,
            hobbies: null,
            languages: null,
            study_reason: null,
            daily_routine: null,
            updated_at: null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/speaking/profile
router.put('/', (req, res) => {
    const {
        name, age, city, country, occupation,
        family_description, hobbies, languages,
        study_reason, daily_routine
    } = req.body;
    const now = Date.now();

    try {
        const stmt = db.prepare(`
            INSERT INTO user_profile (id, name, age, city, country, occupation, family_description, hobbies, languages, study_reason, daily_routine, updated_at)
            VALUES (1, @name, @age, @city, @country, @occupation, @family_description, @hobbies, @languages, @study_reason, @daily_routine, @updated_at)
            ON CONFLICT(id) DO UPDATE SET
                name = @name,
                age = @age,
                city = @city,
                country = @country,
                occupation = @occupation,
                family_description = @family_description,
                hobbies = @hobbies,
                languages = @languages,
                study_reason = @study_reason,
                daily_routine = @daily_routine,
                updated_at = @updated_at
        `);

        stmt.run({
            name: name || null,
            age: age || null,
            city: city || null,
            country: country || 'Nederland',
            occupation: occupation || null,
            family_description: family_description || null,
            hobbies: hobbies || null,
            languages: languages || null,
            study_reason: study_reason || null,
            daily_routine: daily_routine || null,
            updated_at: now
        });

        const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/speaking/profile/custom-fields
router.get('/custom-fields', (req, res) => {
    try {
        const fields = db.prepare('SELECT * FROM user_profile_custom_fields ORDER BY field_name').all();
        res.json(fields);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/speaking/profile/custom-fields
router.post('/custom-fields', (req, res) => {
    const { field_name, field_value } = req.body;

    if (!field_name) {
        return res.status(400).json({ error: 'field_name is required' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO user_profile_custom_fields (field_name, field_value)
            VALUES (@field_name, @field_value)
            ON CONFLICT(field_name) DO UPDATE SET
                field_value = @field_value
        `);

        stmt.run({ field_name, field_value: field_value || null });

        const field = db.prepare('SELECT * FROM user_profile_custom_fields WHERE field_name = ?').get(field_name);
        res.json(field);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/speaking/profile/custom-fields/:fieldName
router.delete('/custom-fields/:fieldName', (req, res) => {
    const { fieldName } = req.params;

    try {
        const result = db.prepare('DELETE FROM user_profile_custom_fields WHERE field_name = ?').run(fieldName);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Custom field not found' });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
