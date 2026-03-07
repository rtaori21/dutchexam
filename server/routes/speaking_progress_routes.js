const express = require('express');
const router = express.Router();
const db = require('../db');

// SRS intervals in milliseconds
const SRS_INTERVALS = {
    0: 0,                  // New, review immediately
    1: 86400000,           // 1 day
    2: 259200000,          // 3 days
    3: 1209600000          // 14 days (mastered)
};

// POST /api/speaking/progress
router.post('/', (req, res) => {
    const { qa_id, confidence } = req.body;

    if (qa_id === undefined || confidence === undefined) {
        return res.status(400).json({ error: 'qa_id and confidence are required' });
    }

    const clampedConfidence = Math.max(0, Math.min(3, confidence));
    const now = Date.now();
    const interval = SRS_INTERVALS[clampedConfidence] || 0;
    const nextReview = now + interval;

    try {
        const existing = db.prepare('SELECT * FROM speaking_progress WHERE qa_id = ?').get(qa_id);
        const timesPracticed = existing ? existing.times_practiced + 1 : 1;

        const stmt = db.prepare(`
            INSERT INTO speaking_progress (qa_id, confidence, times_practiced, last_practiced, next_review)
            VALUES (@qa_id, @confidence, @times_practiced, @last_practiced, @next_review)
            ON CONFLICT(qa_id) DO UPDATE SET
                confidence = @confidence,
                times_practiced = @times_practiced,
                last_practiced = @last_practiced,
                next_review = @next_review
        `);

        stmt.run({
            qa_id,
            confidence: clampedConfidence,
            times_practiced: timesPracticed,
            last_practiced: now,
            next_review: nextReview
        });

        res.json({
            success: true,
            qa_id,
            confidence: clampedConfidence,
            times_practiced: timesPracticed,
            next_review: nextReview
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/speaking/progress/review?topicId=X
router.get('/review', (req, res) => {
    const now = Date.now();
    const topicId = req.query.topicId;
    const limit = 20;

    try {
        let query;
        let params;

        if (topicId) {
            // Due for review (have progress and next_review <= now)
            query = `
                SELECT qa.*, sp.confidence, sp.times_practiced, sp.last_practiced, sp.next_review
                FROM speaking_qa qa
                LEFT JOIN speaking_progress sp ON sp.qa_id = qa.id
                WHERE qa.topic_id = ?
                  AND (sp.qa_id IS NULL OR sp.next_review <= ?)
                ORDER BY
                    CASE WHEN sp.qa_id IS NULL THEN 1 ELSE 0 END,
                    sp.next_review ASC
                LIMIT ?
            `;
            params = [topicId, now, limit];
        } else {
            query = `
                SELECT qa.*, sp.confidence, sp.times_practiced, sp.last_practiced, sp.next_review
                FROM speaking_qa qa
                LEFT JOIN speaking_progress sp ON sp.qa_id = qa.id
                WHERE sp.qa_id IS NULL OR sp.next_review <= ?
                ORDER BY
                    CASE WHEN sp.qa_id IS NULL THEN 1 ELSE 0 END,
                    sp.next_review ASC
                LIMIT ?
            `;
            params = [now, limit];
        }

        const items = db.prepare(query).all(...params);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/speaking/progress/stats
router.get('/stats', (req, res) => {
    try {
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayMs = startOfDay.getTime();

        const stats = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM speaking_qa) AS total,
                (SELECT COUNT(*) FROM speaking_qa WHERE id NOT IN (SELECT qa_id FROM speaking_progress)) AS new_count,
                (SELECT COUNT(*) FROM speaking_progress WHERE confidence > 0 AND confidence < 3) AS learning,
                (SELECT COUNT(*) FROM speaking_progress WHERE confidence >= 3) AS mastered,
                (SELECT COUNT(*) FROM speaking_progress WHERE last_practiced >= ?) AS practiced_today
        `).get(startOfDayMs);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/speaking/progress/topic/:topicId
router.get('/topic/:topicId', (req, res) => {
    try {
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayMs = startOfDay.getTime();

        const stats = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM speaking_qa WHERE topic_id = @topicId) AS total,
                (SELECT COUNT(*) FROM speaking_qa WHERE topic_id = @topicId AND id NOT IN (SELECT qa_id FROM speaking_progress)) AS new_count,
                (SELECT COUNT(*) FROM speaking_progress sp JOIN speaking_qa qa ON qa.id = sp.qa_id WHERE qa.topic_id = @topicId AND sp.confidence > 0 AND sp.confidence < 3) AS learning,
                (SELECT COUNT(*) FROM speaking_progress sp JOIN speaking_qa qa ON qa.id = sp.qa_id WHERE qa.topic_id = @topicId AND sp.confidence >= 3) AS mastered,
                (SELECT COUNT(*) FROM speaking_progress sp JOIN speaking_qa qa ON qa.id = sp.qa_id WHERE qa.topic_id = @topicId AND sp.last_practiced >= @startOfDay) AS practiced_today
        `).get({ topicId: req.params.topicId, startOfDay: startOfDayMs });

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
