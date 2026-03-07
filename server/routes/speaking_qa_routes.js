const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/speaking/qa/:topicId
router.get('/:topicId', (req, res) => {
    try {
        const qas = db.prepare(`
            SELECT 
                qa.*,
                sp.confidence,
                sp.times_practiced,
                sp.last_practiced,
                sp.next_review
            FROM speaking_qa qa
            LEFT JOIN speaking_progress sp ON sp.qa_id = qa.id
            WHERE qa.topic_id = ?
            ORDER BY qa.sort_order ASC, qa.id ASC
        `).all(req.params.topicId);

        res.json(qas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/speaking/qa/item/:id
router.get('/item/:id', (req, res) => {
    try {
        const qa = db.prepare(`
            SELECT 
                qa.*,
                sp.confidence,
                sp.times_practiced,
                sp.last_practiced,
                sp.next_review
            FROM speaking_qa qa
            LEFT JOIN speaking_progress sp ON sp.qa_id = qa.id
            WHERE qa.id = ?
        `).get(req.params.id);

        if (!qa) {
            return res.status(404).json({ error: 'Q&A not found' });
        }

        res.json(qa);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/speaking/qa
router.post('/', (req, res) => {
    const {
        topic_id, question_en, question_nl, question_phonetic,
        answer_en, answer_nl, answer_phonetic,
        grammar_notes, common_mistakes, sort_order
    } = req.body;

    if (!topic_id || !question_en) {
        return res.status(400).json({ error: 'topic_id and question_en are required' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO speaking_qa (
                topic_id, sort_order, question_en, question_nl, question_phonetic,
                answer_en, answer_nl, answer_phonetic,
                grammar_notes, common_mistakes
            ) VALUES (
                @topic_id, @sort_order, @question_en, @question_nl, @question_phonetic,
                @answer_en, @answer_nl, @answer_phonetic,
                @grammar_notes, @common_mistakes
            )
        `);

        const result = stmt.run({
            topic_id,
            sort_order: sort_order || 0,
            question_en,
            question_nl: question_nl || null,
            question_phonetic: question_phonetic || null,
            answer_en: answer_en || null,
            answer_nl: answer_nl || null,
            answer_phonetic: answer_phonetic || null,
            grammar_notes: grammar_notes || null,
            common_mistakes: common_mistakes || null
        });

        const qa = db.prepare('SELECT * FROM speaking_qa WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(qa);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/speaking/qa/:id
router.put('/:id', (req, res) => {
    const {
        question_en, question_nl, question_phonetic,
        answer_en, answer_nl, answer_phonetic,
        grammar_notes, common_mistakes, sort_order, topic_id
    } = req.body;

    try {
        const existing = db.prepare('SELECT * FROM speaking_qa WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Q&A not found' });
        }

        const now = Date.now();

        const stmt = db.prepare(`
            UPDATE speaking_qa SET
                topic_id = @topic_id,
                sort_order = @sort_order,
                question_en = @question_en,
                question_nl = @question_nl,
                question_phonetic = @question_phonetic,
                answer_en = @answer_en,
                answer_nl = @answer_nl,
                answer_phonetic = @answer_phonetic,
                grammar_notes = @grammar_notes,
                common_mistakes = @common_mistakes,
                updated_at = @updated_at
            WHERE id = @id
        `);

        stmt.run({
            id: req.params.id,
            topic_id: topic_id !== undefined ? topic_id : existing.topic_id,
            sort_order: sort_order !== undefined ? sort_order : existing.sort_order,
            question_en: question_en !== undefined ? question_en : existing.question_en,
            question_nl: question_nl !== undefined ? question_nl : existing.question_nl,
            question_phonetic: question_phonetic !== undefined ? question_phonetic : existing.question_phonetic,
            answer_en: answer_en !== undefined ? answer_en : existing.answer_en,
            answer_nl: answer_nl !== undefined ? answer_nl : existing.answer_nl,
            answer_phonetic: answer_phonetic !== undefined ? answer_phonetic : existing.answer_phonetic,
            grammar_notes: grammar_notes !== undefined ? grammar_notes : existing.grammar_notes,
            common_mistakes: common_mistakes !== undefined ? common_mistakes : existing.common_mistakes,
            updated_at: now
        });

        const qa = db.prepare('SELECT * FROM speaking_qa WHERE id = ?').get(req.params.id);
        res.json(qa);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/speaking/qa/:id
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM speaking_qa WHERE id = ?').run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Q&A not found' });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
