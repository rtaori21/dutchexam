const express = require('express');
const router = express.Router();
const db = require('../db');

// Simple SRS intervals in milliseconds (Box 0 to 5)
// 0: 0 (Review now/New)
// 1: 10 min
// 2: 1 day
// 3: 3 days
// 4: 7 days
// 5: 14 days (Mastered?)
const INTERVALS = [
    0,
    10 * 60 * 1000,
    24 * 60 * 60 * 1000,
    3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    14 * 24 * 60 * 60 * 1000
];

// POST /api/progress
// Body: { wordId, result: "correct"|"incorrect"|"remind" }
// Also supports legacy { wordId, correct: boolean }
router.post('/', (req, res) => {
    const { wordId } = req.body;
    // Support both new 'result' field and legacy 'correct' boolean
    let result = req.body.result;
    if (!result) {
        result = req.body.correct ? 'correct' : 'incorrect';
    }
    const now = Date.now();

    try {
        // Get current progress
        const current = db.prepare('SELECT * FROM progress WHERE word_id = ?').get(wordId);

        let box = current ? current.box : 0;
        let nextReview = now;

        if (result === 'correct') {
            // Move to next box, cap at 5
            box = Math.min(box + 1, 5);
        } else if (result === 'remind') {
            // Keep current box, but schedule a quick review in 10 minutes
            // Don't advance the box — user got it right but wants reinforcement
        } else {
            // incorrect — reset to box 1
            box = 1;
        }

        // Calculate next review time
        if (result === 'remind') {
            nextReview = now + 10 * 60 * 1000; // 10 minutes
        } else {
            const interval = INTERVALS[box] || INTERVALS[INTERVALS.length - 1];
            nextReview = now + interval;
        }

        const mastered = box >= 5 ? 1 : 0;

        const stmt = db.prepare(`
      INSERT INTO progress (word_id, box, next_review, mastered)
      VALUES (@wordId, @box, @nextReview, @mastered)
      ON CONFLICT(word_id) DO UPDATE SET
        box = @box,
        next_review = @nextReview,
        mastered = @mastered
    `);

        stmt.run({ wordId, box, nextReview, mastered });

        res.json({ success: true, box, next_review: nextReview, mastered });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/progress/stats
router.get('/stats', (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT 
                (SELECT count(*) FROM words) as total,
                (SELECT count(*) FROM progress WHERE mastered = 1) as mastered,
                (SELECT count(*) FROM progress WHERE box > 0 AND mastered = 0) as learning,
                (SELECT count(*) FROM words WHERE id NOT IN (SELECT word_id FROM progress)) as new_words
        `).get();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
